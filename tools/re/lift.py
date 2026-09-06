#!/usr/bin/env python3
"""
Lifts the code of GOPNIK v1.02 out of g.exe into the annotated pseudo-Pascal
listing the rules in docs/gopnik-logic.md were read off.

    python3 tools/re/lift.py path/to/g.exe

g.exe is not vendored here: it is the original DOS release, kept in xpl/gop
under src/gop/. Its MZ header is stripped to get the flat load image that the
segment table below is indexed against. Writes tools/re/g.exe.lifted.txt.

Needs capstone (pip install capstone).
"""

import json, struct, sys
from pathlib import Path
from capstone import *
from capstone.x86 import *

HERE = Path(__file__).resolve().parent
IMAGE_SIZE = 82304          # g.exe (88 656 bytes) minus its 6 352-byte MZ header


def load_image(path):
    """The flat load module: an MZ file with its header paragraphs removed."""
    data = path.read_bytes()
    if data[:2] != b'MZ':
        sys.exit(f'{path}: not an MZ executable')
    header = struct.unpack('<H', data[8:10])[0] * 16
    image = data[header:]
    if len(image) != IMAGE_SIZE:
        print(f'warning: expected a {IMAGE_SIZE}-byte image, got {len(image)}; '
              'the segment table below is for GOPNIK v1.02', file=sys.stderr)
    return image


if len(sys.argv) != 2:
    sys.exit('usage: python3 tools/re/lift.py path/to/g.exe\n\n'
             'g.exe is the original DOS release; it lives in\n'
             'https://github.com/xpl/gop under src/gop/.')
img=load_image(Path(sys.argv[1]))
md=Cs(CS_ARCH_X86,CS_MODE_16); md.detail=True
SEGBASE={0x0:0,0xee5:0xee50,0xeed:0xeed0,0xf16:0xf160,0xf78:0xf780}
SEGS={0x0:'MAIN',0xee5:'DOSU',0xeed:'PRN',0xf16:'CRT',0xf78:'SYS'}
# Turbo Pascal's per-statement I/O scaffolding; the listing reads better without it.
SKIP_CALLS={'WriteLnEnd','IOCheck','ReadLnEnd'}
names_sys={tuple(int(x,16) for x in k.split(':')):v for k,v in json.load(open(HERE/'names_sys.json')).items()}
dsn={int(k,16):v for k,v in json.load(open(HERE/'dsnames.json')).items()}
procnames=json.load(open(HERE/'procnames.json')) if (HERE/'procnames.json').exists() else {}
def vname(d): return dsn.get(d, f"g_{d:04x}")
def pname(t): return procnames.get(f"{t:04x}", f"PROC_{t:04x}")
def pstr(addr):
    L=img[addr]; s=img[addr+1:addr+1+L]
    try: s=s.decode('cp866')
    except: return None
    if any(ord(c)<32 for c in s): return None
    return s
def dis(a):
    try: return next(md.disasm(img[a:a+16],a))
    except StopIteration: return None
def retcount(addr):
    a=addr; n=0
    while n<6000:
        ins=dis(a)
        if ins is None: return 0
        if ins.mnemonic in('ret','retf'): return ins.operands[0].imm if ins.operands else 0
        if ins.mnemonic=='jmp' and ins.operands[0].type==X86_OP_IMM and (ins.operands[0].imm&0xffff)>a: a=ins.operands[0].imm&0xffff; n+=1; continue
        a+=ins.size; n+=1
    return 0
def parse_far(op_str):
    return [int(x.strip(),16) for x in op_str.replace('0x','').replace(',',':').split(':')]
def disasm_seg(base, entry_list, limit):
    seen=set(); insns={}; queue=list(entry_list); procs=set(entry_list)
    while queue:
        a=queue.pop()
        while a not in seen and base<=a<limit:
            ins=dis(a)
            if ins is None: break
            seen.add(a); insns[a]=ins; m=ins.mnemonic
            if m in('jmp','call') or (m.startswith('j')) or m.startswith('loop'):
                op=ins.operands[0]
                if op.type==X86_OP_IMM and base<=(op.imm&0xffff)<limit:
                    queue.append(op.imm&0xffff)
                    if m=='call': procs.add(op.imm&0xffff)
            if m in ('ret','retf','iret','jmp','ljmp'): break
            a+=ins.size
    return insns, procs

class Lifter:
    def __init__(self, insns, procs, base, limit):
        self.insns=insns; self.procs=procs; self.base=base; self.limit=limit; self.retc={}
        self.strstart=set(); addrs=sorted(insns); prev=base
        for a in addrs:
            if a>prev:
                g=prev
                while g<a:
                    L=img[g]; st=pstr(g) if 0<L else None
                    if st is not None and g+1+L<=a: self.strstart.add(g); g+=1+L
                    else: g+=1
            prev=max(prev,a+insns[a].size)
    def rc(self, seg, off):
        k=(seg,off)
        if k not in self.retc: self.retc[k]=retcount(SEGBASE[seg]+off)
        return self.retc[k]
    def memname(self, op, ins):
        m=op.mem
        if m.base==0 and m.index==0:
            if m.segment in(0,X86_REG_DS): return vname(m.disp)
            return f"{ins.reg_name(m.segment)}:[{m.disp:#x}]"
        base=ins.reg_name(m.base) if m.base else ''; idx=ins.reg_name(m.index) if m.index else ''; d=m.disp
        if base=='bp':
            return (f"loc_{-d:x}" if d<0 else f"arg_{d:x}")+(f"[{idx}]" if idx else '')
        s=base+(('+'+idx) if idx else '')
        return f"[{s}{d:+#x}]" if d else f"[{s}]"
    def fmt(self,v):
        if not v: return '?'
        k=v[0]
        if k=='imm': return str(v[1])
        if k in('mem','memb','memb?'): return v[1]
        if k=='str': return f'"{pstr(v[1])}"'
        if k=='addr': return '@'+v[1]
        if k=='expr': return f"({v[1]})"
        if k=='reg': return v[1]
        return str(v)
    def run(self, out):
        addrs=sorted(self.insns); lines=[]; prev_end=self.base; reg={}; stack=[]
        jt=set()
        for a in addrs:
            ins=self.insns[a]
            if (ins.mnemonic.startswith('j') or ins.mnemonic.startswith('loop')) and ins.operands[0].type==X86_OP_IMM: jt.add(ins.operands[0].imm&0xffff)
        def setreg(r,v):
            reg[r]=v
            if r=='ax': reg.pop('al',None); reg.pop('ah',None)
            if r=='al':
                if v[0]=='imm': reg['ax']=('imm',v[1])
                elif v[0]=='mem': reg['ax']=('memb?',v[1])
                else: reg.pop('ax',None)
            if r=='ah' and v==('imm',0) and reg.get('ax',('',))[0]=='memb?': reg['ax']=('memb',reg['ax'][1])
        for a in addrs:
            if a>prev_end:
                g=prev_end
                while g<a:
                    L=img[g]; s=pstr(g) if 0<L else None
                    if s is not None and g+1+L<=a: lines.append(f"{g:05x}      STR {s!r}"); g+=1+L; continue
                    end=min(a,g+16); lines.append(f"{g:05x}      DB {img[g:end].hex(' ')}"); g=end
                stack.clear(); reg.clear()
            ins=self.insns[a]; m=ins.mnemonic; ops=ins.operands
            if a in self.procs:
                lines.append(f"\n; ===== {pname(a)} =====  ret={retcount(a)}"); stack.clear(); reg.clear()
            if a in jt: lines.append(f"{a:05x} L{a:04x}:"); reg.clear()
            def opstr(op,src=True):
                if op.type==X86_OP_IMM: return str(op.imm)
                if op.type==X86_OP_REG:
                    r=ins.reg_name(op.reg)
                    if src and reg.get(r) and reg[r][0] in('imm','mem','memb','memb?','str','expr'): return f"{r}{{{self.fmt(reg[r])}}}"
                    return r
                return self.memname(op,ins)
            sz=ins.size
            if m=='mov' and ops[0].type==X86_OP_REG and ops[1].type==X86_OP_IMM:
                r=ins.reg_name(ops[0].reg); v=ops[1].imm
                if r in('di','ax') and v in self.strstart: setreg(r,('str',v))
                else: setreg(r,('imm',v))
                prev_end=a+sz; continue
            if m=='xor' and ops[0].type==X86_OP_REG and ops[1].type==X86_OP_REG and ops[0].reg==ops[1].reg:
                setreg(ins.reg_name(ops[0].reg),('imm',0)); prev_end=a+sz; continue
            if m=='mov' and ops[0].type==X86_OP_REG and ops[1].type==X86_OP_MEM:
                setreg(ins.reg_name(ops[0].reg),('mem',self.memname(ops[1],ins))); prev_end=a+sz; continue
            if m=='mov' and ops[0].type==X86_OP_REG and ops[1].type==X86_OP_REG:
                r=ins.reg_name(ops[0].reg); r2=ins.reg_name(ops[1].reg)
                setreg(r, reg.get(r2,('reg',r2))); lines.append(f"{a:05x}      {r} := {r2}"); prev_end=a+sz; continue
            if m=='mov' and ops[0].type==X86_OP_MEM and ops[1].type==X86_OP_REG:
                r=ins.reg_name(ops[1].reg); nm=self.memname(ops[0],ins)
                lines.append(f"{a:05x}      {nm} := {self.fmt(reg[r]) if reg.get(r) else r}"); prev_end=a+sz; continue
            if m=='mov' and ops[0].type==X86_OP_MEM and ops[1].type==X86_OP_IMM:
                lines.append(f"{a:05x}      {self.memname(ops[0],ins)} := {ops[1].imm}"); prev_end=a+sz; continue
            if m in('cdq','cwd'): reg['dx']=('hi',); prev_end=a+sz; continue
            if m=='lea' and ops[0].type==X86_OP_REG:
                setreg(ins.reg_name(ops[0].reg),('addr',self.memname(ops[1],ins))); prev_end=a+sz; continue
            if m=='les' and ops[0].type==X86_OP_REG:
                reg['es:'+ins.reg_name(ops[0].reg)]=('faddr',self.memname(ops[1],ins)); reg.pop(ins.reg_name(ops[0].reg),None); prev_end=a+sz; continue
            if m=='push':
                op=ops[0]
                if op.type==X86_OP_REG:
                    r=ins.reg_name(op.reg)
                    if r in('cs','ds','ss','es'): stack.append((r,))
                    else:
                        v=reg.get(r)
                        if r=='di' and stack and stack[-1]==('cs',) and v and v[0]=='str': stack.pop(); stack.append(('S',f'"{pstr(v[1])}"'))
                        elif r=='di' and stack and stack[-1]==('ds',) and v and v[0]=='imm': stack.pop(); stack.append(('A','@'+vname(v[1])))
                        elif r=='di' and stack and stack[-1]==('ss',) and v and v[0]=='addr': stack.pop(); stack.append(('A','@'+v[1]))
                        elif r=='di' and stack and stack[-1]==('es',) and reg.get('es:di'): stack.pop(); stack.append(('A','@'+reg['es:di'][1]))
                        elif r=='ax' and stack and stack[-1]==('hi',): stack.pop(); stack.append(('L','long('+self.fmt(v)+')'))
                        elif r=='dx' and v==('hi',): stack.append(('hi',))
                        else: stack.append(('V',self.fmt(v) if v else r))
                elif op.type==X86_OP_MEM: stack.append(('V',self.memname(op,ins)))
                else: stack.append(('V',str(op.imm)))
                prev_end=a+sz; continue
            if m in('lcall','call'):
                if m=='lcall':
                    seg,off=parse_far(ins.op_str); n=self.rc(seg,off); name=names_sys.get((seg,off),f"{SEGS.get(seg,hex(seg))}:{off:04x}")
                else:
                    if ops[0].type==X86_OP_IMM: t=ops[0].imm&0xffff; n=retcount(t); name=pname(t)
                    else: n=0; name=f"call {ins.op_str}"
                args=[]; need=n//2
                while need>0:
                    e=stack.pop() if stack else ('V','?'); args.append(e); need-= 2 if e[0] in('S','A','L') else 1
                args=args[::-1]; argl=[]; i=0
                while i<len(args):
                    t=args[i]
                    if t[0] in('cs','ds','ss','es') and i+1<len(args): argl.append(f"{t[0]}:{args[i+1][1]}"); i+=2; continue
                    if t[0]=='hi' and i+1<len(args): argl.append(f"long({args[i+1][1]})"); i+=2; continue
                    argl.append(t[1] if len(t)>1 else t[0]); i+=1
                if name not in SKIP_CALLS:
                    lines.append(f"{a:05x}      {name}({', '.join(argl)})")
                reg.clear(); reg['ax']=('expr',name+'()'); prev_end=a+sz; continue
            if (m.startswith('j') or m.startswith('loop')) and ops[0].type==X86_OP_IMM:
                s=f"{m} L{ops[0].imm&0xffff:04x}"
            else:
                s=f"{m} "+', '.join(opstr(o, src=(i>0 or m in('cmp','test','mul','imul','div','idiv','inc','dec','neg','not'))) for i,o in enumerate(ops))
            if ops and ops[0].type==X86_OP_REG and m in('add','sub','and','or','xor','shl','shr','imul','mul','div','idiv','neg','not','sar','inc','dec'):
                r=ins.reg_name(ops[0].reg); setreg(r,('expr',s))
            elif ops and ops[0].type==X86_OP_REG and m not in('cmp','test'):
                reg.pop(ins.reg_name(ops[0].reg),None)
            if m in('imul','mul','div','idiv'): reg.pop('dx',None); reg.pop('ax',None) if m in('div','idiv') else None
            lines.append(f"{a:05x}      {s}")
            prev_end=a+sz
        open(out,'w').write('\n'.join(lines))

ins0,p0=disasm_seg(0,[0xab59],0xee50)
out=HERE/'g.exe.lifted.txt'
Lifter(ins0,p0,0,0xee50).run(out)
print(f"wrote {out.name} ({len(ins0)} instructions lifted)")
