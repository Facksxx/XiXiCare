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
    image = Image.new('RGBA', (840, 360), (0, 0, 0, 0))
    draw = ImageDraw.Draw(image)
    draw.rounded_rectangle((0, 0, 839, 359), radius=66, fill=background)
    draw.text((54, 26), '瓶喂奶量', font=ImageFont.truetype(FONT, 45), fill=title)
    draw.text((278, 36), '近7天', font=ImageFont.truetype(FONT, 36), fill=muted)
    draw.ellipse((696, 24, 786, 114), fill=switch_background)
    draw.line((719, 58, 763, 58), fill=switch_text, width=4)
    draw.line((755, 49, 764, 58, 755, 67), fill=switch_text, width=4, joint='curve')
    draw.line((763, 82, 719, 82), fill=switch_text, width=4)
    draw.line((727, 73, 718, 82, 727, 91), fill=switch_text, width=4, joint='curve')
    values = (120, 180, 150, 210, 160, 240, 200)
    days = ('12', '13', '14', '15', '16', '17', '18')
    value_font = ImageFont.truetype(FONT, 36)
    day_font = ImageFont.truetype(FONT, 33)
    for i, value in enumerate(values):
        x = 96 + i * 105
        height = max(24, value * .38)
        draw.rounded_rectangle((x-30, 238-height, x+30, 238), radius=18, fill=bar_highlight if value == max(values) else bar)
        draw.text((x, 220-height), str(value), font=value_font, fill=title if value == max(values) else value_text, anchor='mm')
        draw.text((x, 274), days[i], font=day_font, fill=muted, anchor='mm')
    draw.line((54, 291, 786, 291), fill=border, width=3)
    draw.text((54, 307), '日均 180ml（不包含今日）', font=ImageFont.truetype(FONT, 36), fill=muted)
    draw.rounded_rectangle((604, 300, 786, 336), radius=18, fill=switch_background)
    draw.text((695, 318), '↑ 记一笔', font=ImageFont.truetype(FONT, 33), fill=switch_text, anchor='mm')
    folder = project / 'android/app/src/main/res' / ('drawable-night-nodpi' if dark else 'drawable-nodpi')
    folder.mkdir(parents=True, exist_ok=True)
    image.save(folder / 'formula_widget_preview.png')


for name in ('.',):
    for dark_mode in (False, True):
        draw_preview(ROOT / name, dark_mode)
