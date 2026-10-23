from PIL import Image,ImageDraw,ImageFont
from pathlib import Path
import json,textwrap
P=Path(__file__).parent
W,H=1080,1440
B='#141414'; F='#F4F1E8'
FONT='/usr/share/fonts/opentype/noto/NotoSansCJK-Regular.ttc'
BOLD='/usr/share/fonts/opentype/noto/NotoSansCJK-Bold.ttc'
def font(n,b=False): return ImageFont.truetype(BOLD if b else FONT,n,index=2)
def wrap(d,s,f,width):
 out=[];line=''
 for c in s:
  if c=='\n':out.append(line);line='';continue
  if d.textlength(line+c,font=f)>width:out.append(line);line=c
  else:line+=c
 if line:out.append(line)
 return out
def text(d,s,x,y,n=34,width=920,b=False,fill=B,gap=16):
 for line in wrap(d,s,font(n,b),width):
  d.text((x,y),line,font=font(n,b),fill=fill);y+=n+gap
 return y
pages=[
{'title':'只有两种颜色，\n世界也能很不同','sub':'黑白 / 极限限色图形语言','blocks':[('今天拆解三条路线','Minit：轮廓与大色块\nObra Dinn：3D空间与抖动\nWORLD OF HORROR：网点与信息分区'),('先别急着生成素材','限制颜色，不等于降低设计难度。\n先决定玩家要看见什么，再决定删掉什么。')],'diagram':'cover'},
{'title':'Minit','sub':'用大色块保护小角色','blocks':[('参考观察：轮廓比纹理更重要','粗像素人物嵌在大块黑白环境中。场景可以有砖缝，但角色边缘不能被同色背景吞掉。'),('借鉴：统一像素单位','先做角色与障碍的剪影测试，再添地面纹理。把重要物体与背景的黑白关系反过来。'),('代价：少颜色也会难读','不能只靠颜色区分道具与敌人；还要靠外形、位置和动画。')],'diagram':'minit'},
{'title':'Return of the\nObra Dinn','sub':'两色视觉，仍然是3D空间','blocks':[('参考观察：点阵承担中间明暗','怀表、手和尸体通过轮廓、遮挡与疏密点阵分开。地板透视提供空间方向。'),('借鉴：先搭空间，再限色','先用简模和灯光做可读体块，再实验限色输出；不要拿一张AI插画假装可漫游场景。'),('代价：移动时更难稳定','细线和密集点阵缩小后可能混成噪声。必须在目标分辨率与镜头运动中检查。')],'diagram':'obra'},
{'title':'WORLD OF HORROR','sub':'恐怖插画，也是一张操作桌面','blocks':[('参考观察：黑白分区建立秩序','人物面部与网点形成视觉压力；文字窗口、选项和右侧状态栏用边框与留白分隔。'),('借鉴：先给阅读留位置','先划分插画、正文、操作区，再加网点。恐怖感可以很浓，但按钮含义要明确。'),('代价：密度有阅读成本','高密度细线不适合直接缩成手机小图。中文字体、长文与按钮需另做适配。')],'diagram':'woh'},
{'title':'不是一个滤镜，\n而是三种组织方式','sub':'先选玩法，再选限色路线','blocks':[('Minit｜低纹理、重轮廓','俯视2D · 动作与探索\n切入点：一个单屏房间 + 少量精灵'),('Obra Dinn｜透视、遮挡、点阵','第一人称3D · 观察与推理\n切入点：一个静态小场景 + 两色输出实验'),('WORLD OF HORROR｜插画、网点、面板','2D事件/回合制 · 阅读与决策\n切入点：一张事件插画 + 一套信息面板')],'diagram':'compare'},
{'title':'AI做候选，\n人来定规则','sub':'Godot + DSH 的可验证流程','blocks':[('01 → 03｜先锁规格','定视角和像素单位 → 生成少量候选 → 人工重画轮廓与二值化。严格两色，不偷偷混入灰边。'),('04 → 06｜再进引擎','拆分透明素材 → 在Godot检查尺寸、过滤与碰撞 → 测试动作衔接与不同背景。'),('三个常见坑','角色换动作就变形；假透明棋盘被画进图；纹理太密导致重要对象消失。DSH只按实际可用能力协作，不假定一键成品。')],'diagram':'ai'},
{'title':'45分钟练习：\n黑白渡口','sub':'原创练习 · 不是游戏截图','blocks':[('时间分配','10分钟：画单屏轮廓与通路\n15分钟：做角色、铃铛、小船素材\n10分钟：导入Godot，连通敲铃与上船\n10分钟：测试走近—敲铃—上船'),('验收清单','两色一致 / 角色不融入背景 / 通路清楚\n透明边缘无杂色 / 实际尺寸仍能辨认\n碰撞边界相符 / 敲铃后小船可进入'),('资料与状态','官方Steam商店：609490 / 653530 / 913740\n完整分析与来源见第004期网页。\n本包只有原创文字与几何图解，无游戏截图。\n图文包已生成，尚未发布。')],'diagram':'exercise'}
]
def diagram(d,kind,y):
 # original schematic only, never game art
 x=72; ww=936; hh=220
 d.rectangle((x,y,x+ww,y+hh),outline=B,width=3)
 if kind in ['cover','compare']:
  for i,label in enumerate(['轮廓','点阵','分区']):
   a=x+25+i*310;d.rectangle((a,y+22,a+275,y+150),outline=B,width=3)
   if i==0:d.rectangle((a+80,y+40,a+195,y+130),fill=B)
   elif i==1:
    for yy in range(y+35,y+142,12):
     for xx in range(a+15,a+260,12):
      if (xx//12+yy//12)%3:d.rectangle((xx,yy,xx+3,yy+3),fill=B)
   else:
    d.rectangle((a+15,y+35,a+145,y+138),fill=B);d.rectangle((a+160,y+35,a+260,y+80),outline=B,width=3);d.rectangle((a+160,y+95,a+260,y+138),outline=B,width=3)
   text(d,label,a+85,y+160,27,width=180)
 elif kind=='minit':
  d.rectangle((x+25,y+30,x+420,y+155),fill=B);d.rectangle((x+175,y+60,x+230,y+125),fill=F)
  d.rectangle((x+510,y+30,x+900,y+155),outline=B,width=3);d.rectangle((x+675,y+60,x+730,y+125),fill=B)
  text(d,'保持对比，而不是无限加纹理',x+170,y+165,27,width=800)
 elif kind=='obra':
  for i in range(6):
   xx=x+60+i*145;d.line((x+468,y+25,xx,y+150),fill=B,width=2)
  for yy in range(y+85,y+150,12):
   for xx in range(x+100,x+850,15):d.rectangle((xx,yy,xx+2,yy+2),fill=B)
  text(d,'透视负责空间，疏密负责明暗',x+170,y+165,27,width=800)
 elif kind=='woh':
  for r in [(25,20,320,150),(340,20,700,110),(340,120,700,150),(720,20,910,150)]:d.rectangle((x+r[0],y+r[1],x+r[2],y+r[3]),outline=B,width=3)
  text(d,'插画区    正文与操作区    状态区',x+135,y+165,27,width=800)
 elif kind=='ai':
  text(d,'规格 → 候选 → 人工清理 → 引擎验证',x+70,y+72,35,width=830,b=True)
 else:
  d.rectangle((x+25,y+35,x+390,y+135),fill=B);d.rectangle((x+550,y+35,x+910,y+135),fill=B)
  d.rectangle((x+390,y+70,x+550,y+100),fill=B)
  text(d,'先保证看得懂、走得通，再加细节',x+140,y+165,27,width=830)
for idx,p in enumerate(pages,1):
 im=Image.new('RGB',(W,H),F);d=ImageDraw.Draw(im)
 text(d,'游戏美术研习室   /   FIELD NOTES 004',72,52,26,b=True)
 d.line((72,109,1008,109),fill=B,width=3)
 y=text(d,p['title'],72,145,62,b=True,gap=10)
 y=text(d,p['sub'],72,y+20,32,width=936)+25
 diagram(d,p['diagram'],y);y+=248
 for heading,body in p['blocks']:
  y=text(d,heading,72,y,34,b=True,gap=8)+8
  y=text(d,body,72,y,30,width=936,gap=11)+24
 if y>1330:raise RuntimeError((idx,y))
 d.line((72,1353,1008,1353),fill=B,width=2)
 text(d,'原创图解 · 非实机画面     2026.10.23',72,1372,23)
 text(d,f'{idx:02d} / 07',875,1372,23,width=150)
 im.save(P/f'{idx:02d}.png')
(P/'layout.json').write_text(json.dumps(pages,ensure_ascii=False,indent=2))
thumb=Image.new('RGB',(4*270,2*360),'#dddddd')
for i in range(7):
 im=Image.open(P/f'{i+1:02d}.png');im.thumbnail((270,360));thumb.paste(im,((i%4)*270,(i//4)*360))
thumb.save(P/'contact-sheet.jpg')
print('7 cards generated; no overflow')
