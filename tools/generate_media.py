"""Generate original code-drawn orbital artwork; never modify supplied logos."""
from pathlib import Path
import math,json,random,subprocess
from PIL import Image,ImageDraw
import imageio_ffmpeg
ROOT=Path(__file__).resolve().parents[1]
OUT=ROOT/"Frontend"/"public"/"assets"
SEQ=OUT/"sequence"
SIZE=640
def render(index):
    t=index/319
    image=Image.new("RGB",(SIZE,SIZE),(8,10,13))
    draw=ImageDraw.Draw(image)
    random.seed(37)
    for _ in range(75):
        x,y=random.randrange(SIZE),random.randrange(SIZE)
        brightness=random.randrange(25,70)
        draw.ellipse((x,y,x+1,y+1),fill=(brightness,brightness,int(brightness*.75)))
    center=SIZE/2
    tilt=.35+.4*math.sin(t*math.pi)
    for ring in range(8):
        radius=150+ring*19
        points=[]
        for step in range(241):
            angle=step/240*math.tau
            x=radius*math.cos(angle)
            y=radius*math.sin(angle)*tilt
            rotate=t*math.tau*.5+ring*.21
            xx=x*math.cos(rotate)-y*math.sin(rotate)
            yy=x*math.sin(rotate)+y*math.cos(rotate)
            points.append((center+xx,center+yy))
        brightness=70+ring*7
        draw.line(points,fill=(brightness,int(brightness*.77),int(brightness*.4)),width=1)
        spot=points[int((t*120+ring*29)%240)]
        draw.ellipse((spot[0]-3,spot[1]-3,spot[0]+3,spot[1]+3),fill=(205,170,95))
    for radius in (95,98):
        draw.ellipse((center-radius,center-radius,center+radius,center+radius),outline=(42,36,25),width=1)
    return image
def main():
    SEQ.mkdir(parents=True,exist_ok=True)
    for i in range(320):
        render(i).save(SEQ/f"frame-{i+1:03d}.webp",quality=68,method=4)
    OUT.joinpath("sequence-manifest.json").write_text(json.dumps({"frames":320,"width":SIZE,"height":SIZE,"format":"webp","cacheWindow":25}))
    ffmpeg=imageio_ffmpeg.get_ffmpeg_exe()
    process=subprocess.Popen([ffmpeg,"-y","-f","rawvideo","-vcodec","rawvideo","-s","640x640","-pix_fmt","rgb24","-r","24","-i","-",
        "-an","-c:v","libvpx-vp9","-b:v","0","-crf","40","-pix_fmt","yuv420p",str(OUT/"atmosphere.webm")],stdin=subprocess.PIPE,stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL)
    for i in range(144):
        frame=render(int((1-math.cos(i/144*math.tau))*.5*319))
        process.stdin.write(frame.tobytes())
    process.stdin.close()
    if process.wait()!=0:
        raise RuntimeError("Video encoding failed")
    print("Generated 320 WebP frames and a separate 6-second looping WebM atmosphere.")
if __name__=="__main__":
    main()

