from pathlib import Path
from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parents[1]
FONT = '/System/Library/Fonts/STHeiti Medium.ttc'


def draw_preview(project: Path, dark: bool):
    background = '#FFFFFF'
    border = '#E8E9EB'
    title = '#252527'
    value_text = '#47474A'
    muted = '#A4A5A9'
    bar = '#ECBC91'
    bar_highlight = '#D48A50'
    switch_background = '#F4F5F6'
    switch_text = '#66676B'
    image = Image.new('RGBA', (840, 420), (0, 0, 0, 0))
    draw = ImageDraw.Draw(image)
    draw.rounded_rectangle((0, 0, 839, 419), radius=66, fill=background)
    draw.text((54, 50), '瓶喂奶量', font=ImageFont.truetype(FONT, 45), fill=title)
    draw.text((278, 60), '近7天', font=ImageFont.truetype(FONT, 36), fill=muted)
    draw.ellipse((702, 42, 786, 126), fill=switch_background)
    draw.line((723, 73, 765, 73), fill=switch_text, width=4)
    draw.line((757, 64, 766, 73, 757, 82), fill=switch_text, width=4, joint='curve')
    draw.line((765, 95, 723, 95), fill=switch_text, width=4)
    draw.line((731, 86, 722, 95, 731, 104), fill=switch_text, width=4, joint='curve')
    values = (120, 180, 150, 210, 160, 240, 200)
    days = ('12', '13', '14', '15', '16', '17', '18')
    value_font = ImageFont.truetype(FONT, 36)
    day_font = ImageFont.truetype(FONT, 33)
    for i, value in enumerate(values):
        x = 96 + i * 105
        height = max(24, value * .38)
        draw.rounded_rectangle((x-30, 280-height, x+30, 280), radius=18, fill=bar_highlight if value == max(values) else bar)
        draw.text((x, 262-height), str(value), font=value_font, fill=title if value == max(values) else value_text, anchor='mm')
        draw.text((x, 312), days[i], font=day_font, fill=muted, anchor='mm')
    draw.line((54, 330, 786, 330), fill=border, width=3)
    draw.text((54, 349), '日均 180ml（不包含今日）', font=ImageFont.truetype(FONT, 36), fill=muted)
    draw.rounded_rectangle((604, 342, 786, 378), radius=18, fill=switch_background)
    draw.text((695, 360), '↑ 记一笔', font=ImageFont.truetype(FONT, 33), fill=switch_text, anchor='mm')
    folder = project / 'android/app/src/main/res' / ('drawable-night-nodpi' if dark else 'drawable-nodpi')
    folder.mkdir(parents=True, exist_ok=True)
    image.save(folder / 'formula_widget_preview.png')


for name in ('.',):
    for dark_mode in (False, True):
        draw_preview(ROOT / name, dark_mode)
