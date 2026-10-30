#!/usr/bin/env python3
"""Render the versioned Markdown handoff to a readable, reproducible PDF.
Requires ReportLab (see docs/requirements.txt). No network or private inputs.
"""
from html import escape
from pathlib import Path
import re
import os
os.environ.setdefault("SOURCE_DATE_EPOCH", "1793318400")
import textwrap
from reportlab import rl_config
from reportlab.lib import colors
from reportlab.lib.enums import TA_LEFT
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import mm
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, PageBreak, Preformatted, LongTable, TableStyle, KeepTogether

root=Path(__file__).resolve().parents[1]
source=root/'docs/security/validation-and-error-patterns.md'
output=root/'docs/security/validation-and-error-patterns.pdf'
rl_config.invariant=1
font_path=Path('/usr/share/fonts/truetype/dejavu')
if not font_path.exists():
    raise SystemExit('Install DejaVu fonts (fonts-dejavu-core) before rendering the handoff.')
for name,file in [('Room','DejaVuSans.ttf'),('RoomBold','DejaVuSans-Bold.ttf'),('RoomMono','DejaVuSansMono.ttf')]:
    pdfmetrics.registerFont(TTFont(name,str(font_path/file)))
pdfmetrics.registerFontFamily('Room',normal='Room',bold='RoomBold',italic='Room',boldItalic='RoomBold')
navy=colors.HexColor('#11283f'); teal=colors.HexColor('#087f8c'); grey=colors.HexColor('#526372')
styles={
 'body':ParagraphStyle('body',fontName='Room',fontSize=9.1,leading=14,textColor=navy,spaceAfter=9),
 'heading':ParagraphStyle('heading',fontName='RoomBold',fontSize=20,leading=26,textColor=navy,spaceAfter=18,keepWithNext=True),
 'small':ParagraphStyle('small',fontName='Room',fontSize=8,leading=12,textColor=grey,spaceAfter=10),
 'code':ParagraphStyle('code',fontName='RoomMono',fontSize=7.3,leading=11,textColor=navy,backColor=colors.HexColor('#edf3f7'),borderPadding=9,spaceBefore=5,spaceAfter=14),
 'cell':ParagraphStyle('cell',fontName='Room',fontSize=7.8,leading=10,textColor=navy),
 'header':ParagraphStyle('header',fontName='RoomBold',fontSize=7.8,leading=10,textColor=colors.white),
 'title':ParagraphStyle('title',fontName='RoomBold',fontSize=35,leading=42,textColor=navy,spaceAfter=25),
}

def inline(text):
    value=escape(text)
    value=re.sub(r'`([^`]+)`',r'<font name="RoomMono">\1</font>',value)
    value=re.sub(r'\*\*([^*]+)\*\*',r'<b>\1</b>',value)
    return value

width=174*mm
story=[Spacer(1,28*mm),Paragraph('ROOM / ENGINEERING HANDOFF',styles['small']),Spacer(1,6*mm),
       Paragraph('Validation and<br/>Error Patterns',styles['title']),
       Paragraph('Member 5 · Cybersecurity and DevOps',styles['body']),
       Paragraph('Version 1.0  /  30 October 2026',styles['small']),Spacer(1,10*mm)]
lines=source.read_text().splitlines();i=1
while i<len(lines):
    line=lines[i].strip()
    if not line: i+=1;continue
    if line.startswith('Room team handoff'):i+=1;continue
    if line.startswith('## '):
        story.extend([PageBreak(),Paragraph('TEAM IMPLEMENTATION CONTRACT',styles['small']),Paragraph(inline(line[3:]),styles['heading'])]);i+=1;continue
    if line.startswith('```'):
        block=[];i+=1
        while i<len(lines) and not lines[i].startswith('```'):
            block.extend(textwrap.wrap(lines[i],width=103,replace_whitespace=False,drop_whitespace=False,subsequent_indent='  ') or ['']);i+=1
        story.append(Preformatted('\n'.join(block),styles['code']));i+=1;continue
    if line.startswith('|'):
        rows=[]
        while i<len(lines) and lines[i].strip().startswith('|'):
            cells=[c.strip() for c in lines[i].strip().strip('|').split('|')]
            if not all(re.fullmatch(r'[-: ]+',cell) for cell in cells): rows.append(cells)
            i+=1
        count=len(rows[0]);fractions=[.12,.41,.47] if count==3 else [.16,.84]
        data=[[Paragraph(inline(cell),styles['header' if row==0 else 'cell']) for cell in cells] for row,cells in enumerate(rows)]
        table=LongTable(data,colWidths=[width*x for x in fractions],repeatRows=1,hAlign='LEFT')
        table.setStyle(TableStyle([
            ('BACKGROUND',(0,0),(-1,0),navy),('ROWBACKGROUNDS',(0,1),(-1,-1),[colors.HexColor('#f0f5f8'),colors.white]),
            ('VALIGN',(0,0),(-1,-1),'TOP'),('LEFTPADDING',(0,0),(-1,-1),8),('RIGHTPADDING',(0,0),(-1,-1),8),
            ('TOPPADDING',(0,0),(-1,-1),5),('BOTTOMPADDING',(0,0),(-1,-1),5),
            ('LINEBELOW',(0,0),(-1,0),1,teal),('LINEBELOW',(0,1),(-1,-1),.25,colors.HexColor('#d6e1e8')),
        ]));story.extend([table,Spacer(1,12)]);continue
    if line.startswith('- '):
        story.append(Paragraph('• '+inline(line[2:]),styles['body']));i+=1;continue
    paragraph=[line];i+=1
    while i<len(lines) and lines[i].strip() and not lines[i].startswith(('## ','```','|','- ')):
        paragraph.append(lines[i].strip());i+=1
    story.append(Paragraph(inline(' '.join(paragraph)),styles['body']))

def frame(canvas,doc):
    canvas.saveState();pagewidth,pageheight=doc.pagesize
    canvas.setStrokeColor(teal);canvas.setLineWidth(2);canvas.line(18*mm,pageheight-16*mm,pagewidth-18*mm,pageheight-16*mm)
    canvas.setFont('Room',7);canvas.setFillColor(grey)
    canvas.drawString(18*mm,12*mm,'ROOM  /  Member 5  /  Team handoff v1.0')
    canvas.drawRightString(pagewidth-18*mm,12*mm,f'{doc.page}')
    canvas.restoreState()

doc=SimpleDocTemplate(str(output),pagesize=(210*mm,297*mm),rightMargin=18*mm,leftMargin=18*mm,topMargin=25*mm,bottomMargin=22*mm,
                      title='Validation and Error Patterns — Room',author='Room — Member 5',subject='Common security validation contracts and integration handoff')
doc.build(story,onFirstPage=frame,onLaterPages=frame)
print(f'Generated {output.relative_to(root)}')
