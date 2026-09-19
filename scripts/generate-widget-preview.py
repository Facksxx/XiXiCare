from pathlib import Path
from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parents[1]
FONT = '/System/Library/Fonts/STHeiti Medium.ttc'


def draw_preview(project: Path, dark: bool):
    background = '#1F2420' if dark else '#FFF9F3'
    title = '#F2F4F1' if dark else '#302B27'
    muted = '#BCC8C0' if dark else '#736C65'
    bar = '#E2A47F' if dark else '#D99A72'
    baseline = '#526057' if dark else '#E8E1DA'
    image = Image.new('RGBA', (840, 360), (0, 0, 0, 0))
    draw = ImageDraw.Draw(image)
    draw.rounded_rectangle((0, 0, 839, 359), radius=60, fill=background)
    draw.text((42, 38), '瓶喂奶量 · 近7天', font=ImageFont.truetype(FONT, 36), fill=title)
    draw.text((696, 38), '切换', font=ImageFont.truetype(FONT, 36), fill=muted)
    values = (120, 180, 150, 210, 160, 240, 200)
    days = ('12', '13', '14', '15', '16', '17', '18')
    draw.line((42, 264, 798, 264), fill=baseline, width=2)
    value_font = ImageFont.truetype(FONT, 28)
    day_font = ImageFont.truetype(FONT, 27)
    for i, value in enumerate(values):
        x = 96 + i * 105
        draw.rounded_rectangle((x-22, 264-value/4, x+22, 264), radius=9, fill=bar)
        draw.text((x, 248-value/4), str(value), font=value_font, fill=title, anchor='mm')
        draw.text((x, 288), days[i], font=day_font, fill=muted, anchor='mm')
    draw.text((42, 319), '日均 180ml（不包含今日）', font=ImageFont.truetype(FONT, 29), fill=muted)
    folder = project / 'android/app/src/main/res' / ('drawable-night-nodpi' if dark else 'drawable-nodpi')
    folder.mkdir(parents=True, exist_ok=True)
    image.save(folder / 'formula_widget_preview.png')


for name in ('.', 'XIXI-CARE-Offline'):
    for dark_mode in (False, True):
        draw_preview(ROOT / name, dark_mode)
