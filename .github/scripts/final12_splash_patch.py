from pathlib import Path

html = Path('app.html')
s = html.read_text(encoding='utf-8')
s = s.replace('styles.css?v=20261004final11','styles.css?v=20261004final12')
s = s.replace('app.js?v=20261004final11','app.js?v=20261004final12')
s = s.replace('FINAL · 2026.10.04 · 11','FINAL · 2026.10.04 · 12')
html.write_text(s, encoding='utf-8')

css = Path('styles.css')
s = css.read_text(encoding='utf-8')
marker = '/* final12 · fullscreen monochrome CODE splash */'
if marker not in s:
    s += r'''

/* final12 · fullscreen monochrome CODE splash */
html,body{background:#02060a!important;min-height:100%;min-height:100dvh}
body:not(.access-granted){padding-bottom:0;background:#02060a!important}
#splash{top:0;right:0;bottom:auto;left:0;width:100vw;height:100vh;height:100dvh;min-height:100svh;background:#02060a;overscroll-behavior:none;isolation:isolate}
.splash-bg{position:absolute;inset:-4px;background:linear-gradient(180deg,rgba(0,5,9,.16),rgba(0,4,8,.72)),url('https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=1600&q=88') 50% 50%/cover no-repeat;filter:grayscale(1) brightness(.52) contrast(1.24);transform:scale(1.035);transform-origin:center}
.splash-vignette{position:absolute;inset:0;background:radial-gradient(circle at 50% 38%,rgba(25,37,45,.02) 0,rgba(2,8,12,.16) 42%,rgba(0,4,7,.82) 100%),linear-gradient(180deg,rgba(0,0,0,.18),rgba(0,0,0,.48))}
.splash-vignette:after{content:"";position:absolute;inset:0;pointer-events:none;opacity:.16;background:repeating-linear-gradient(180deg,rgba(255,255,255,.035) 0,rgba(255,255,255,.035) 1px,transparent 1px,transparent 4px),linear-gradient(90deg,rgba(21,48,61,.10),transparent 38%,rgba(21,48,61,.07))}
.splash-copy{text-shadow:0 2px 22px rgba(0,0,0,.78)}
.splash-logo{color:#f4f6f7}
.splash-tag{color:#d7dde1}
.splash-hint{border-color:rgba(255,255,255,.17);background:rgba(0,5,9,.46);color:#e2e6e9;box-shadow:0 10px 32px rgba(0,0,0,.22)}
@supports(-webkit-touch-callout:none){#splash{min-height:-webkit-fill-available}.splash-bg{min-height:-webkit-fill-available}}
'''
css.write_text(s, encoding='utf-8')

assert marker in css.read_text(encoding='utf-8')
assert '20261004final12' in html.read_text(encoding='utf-8')
