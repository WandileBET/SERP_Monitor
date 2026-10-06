"""Import all real SERP keyword workbooks into PostgreSQL."""
from __future__ import annotations
import os
import sys
from datetime import datetime, time as dt_time
from pathlib import Path
from urllib.parse import urlparse
from zoneinfo import ZoneInfo
from openpyxl import load_workbook
from sqlalchemy import create_engine, select
from sqlalchemy.orm import Session
ROOT=Path(__file__).resolve().parents[1]
BACKEND=ROOT/'backend'
os.chdir(ROOT)
sys.path.insert(0,str(BACKEND))
from app.config import get_settings  # noqa: E402
from app.models import Capture, Keyword, SerpResult  # noqa: E402
TIMEZONE=ZoneInfo('Africa/Johannesburg')
EXPECTED_HEADERS=['Keyword','Name','Date']+[f'{h:02d}:00' for h in range(24)]+['Current Rank']

def normalized(value): return ' '.join(str(value or '').split()).strip()
def as_date(value):
    if hasattr(value,'date') and hasattr(value,'hour'): return value.date()
    if hasattr(value,'strftime'): return value
    return datetime.strptime(str(value)[:10],'%Y-%m-%d').date()
def source_state(state_ws):
    mapping={}
    if not state_ws: return mapping
    for row in range(2,state_ws.max_row+1):
        d=state_ws.cell(row,1).value; kw=normalized(state_ws.cell(row,2).value); vr=state_ws.cell(row,3).value; key=state_ws.cell(row,4).value; name=normalized(state_ws.cell(row,5).value)
        if not d or not kw or not vr or not key: continue
        try: row_no=int(vr)
        except (TypeError,ValueError): continue
        key_text=str(key); url,title=(key_text.split('|',1)+[''])[:2] if '|' in key_text else (key_text,'')
        mapping[(str(as_date(d)),kw,row_no)]={'url':url,'title':title,'name':name}
    return mapping

def load_rows(path):
    wb=load_workbook(path,read_only=False,data_only=True)
    ws=wb['SERP Rankings'] if 'SERP Rankings' in wb.sheetnames else None
    if ws is None: raise RuntimeError(f'{path.name}: missing SERP Rankings worksheet.')
    state=source_state(wb['_State'] if '_State' in wb.sheetnames else None)
    headers=[ws.cell(1,c).value for c in range(1,29)]
    if headers!=EXPECTED_HEADERS: raise RuntimeError(f'{path.name}: invalid hourly workbook headers.')
    captures={}
    for row in range(2,ws.max_row+1):
        kw=normalized(ws.cell(row,1).value); name=normalized(ws.cell(row,2).value); dv=ws.cell(row,3).value
        if not kw or not name or not dv: continue
        date_obj=as_date(dv); date_str=date_obj.strftime('%Y-%m-%d')
        for hour in range(24):
            value=ws.cell(row,4+hour).value
            if value in (None,''): continue
            try: rank=int(value)
            except (TypeError,ValueError): continue
            if not 1<=rank<=100: continue
            captured=datetime.combine(date_obj,dt_time(hour=hour),tzinfo=TIMEZONE)
            captures.setdefault((kw,captured),[]).append((row,rank,name,date_str))
    wb.close(); return captures,state

WORKBOOK_DIRS=[
    Path(__file__).resolve().parent,
]
def discover_workbooks():
    seen=set(); paths=[]
    for folder in WORKBOOK_DIRS:
        if not folder.exists(): continue
        for path in sorted(folder.glob('*_rankings.xlsx')):
            key=path.name.lower()
            if key in seen or not path.is_file() or path.stat().st_size<=0: continue
            seen.add(key); paths.append(path)
    return paths
def import_workbook(db,path):
    captures,state=load_rows(path); ins=upd=0
    for (kw_text,captured_at),rows in sorted(captures.items(),key=lambda x:x[0][1]):
        kw=db.scalar(select(Keyword).where(Keyword.keyword==kw_text))
        if kw is None:
            kw=Keyword(keyword=kw_text,active=True); db.add(kw); db.flush()
        cap=db.scalar(select(Capture).where(Capture.keyword_id==kw.id,Capture.captured_at==captured_at))
        if cap is None:
            cap=Capture(keyword_id=kw.id,captured_at=captured_at,source='excel'); db.add(cap); db.flush(); ins+=1
        else: upd+=1
        existing={r.rank:r for r in db.scalars(select(SerpResult).where(SerpResult.capture_id==cap.id))}
        for row_no,rank,name,date_str in rows:
            meta=state.get((date_str,kw_text,row_no),{}); result_name=meta.get('name') or name; url=meta.get('url') or None; title=meta.get('title') or None
            domain=urlparse(url).netloc.lower() if url else None
            if domain and domain.startswith('www.'): domain=domain[4:]
            item=existing.get(rank)
            if item is None:
                db.add(SerpResult(capture_id=cap.id,keyword_id=kw.id,rank=rank,name=result_name,domain=domain,url=url,title=title))
            else:
                item.name=result_name; item.domain=domain; item.url=url; item.title=title
    return ins,upd

def main():
    settings=get_settings(); paths=discover_workbooks()
    if not paths: print('No keyword ranking workbooks found; nothing to import.'); return 0
    engine=create_engine(settings.database_url,pool_pre_ping=True,future=True); total_i=total_u=0
    with Session(engine) as db:
        for path in paths:
            try:
                i,u=import_workbook(db,path); db.commit(); total_i+=i; total_u+=u; print(f'{path.name}: captures created={i}, existing captures refreshed={u}.')
            except Exception as exc:
                db.rollback(); print(f'{path.name}: SYNC SKIPPED: {exc}',file=sys.stderr); continue
    print(f'Imported all real Excel data: captures created={total_i}, existing captures refreshed={total_u}.'); return 0
if __name__=='__main__': raise SystemExit(main())
