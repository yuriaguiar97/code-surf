from pathlib import Path
import re

# 1) Forecast wording: mixed -> regular
p = Path('app.js')
s = p.read_text()
old = "return{cls:'mixed',text:'CONDIÇÕES MISTAS'}"
new = "return{cls:'mixed',text:'CONDIÇÕES REGULARES'}"
assert old in s, 'mixed-condition label not found'
s = s.replace(old, new)
p.write_text(s)

# 2) Register CODE: round button, text only in two lines
p = Path('app.html')
h = p.read_text()
pattern = re.compile(r'<a class="nav-register" href="#register" aria-label="Register CODE">.*?</a>')
replacement = '<a class="nav-register" href="#register" aria-label="Register CODE"><span class="register-word">Register</span><span class="code-word">CODE</span></a>'
h, count = pattern.subn(replacement, h)
assert count >= 5, f'expected nav-register in all screens, found {count}'
h = h.replace('styles.css?v=20261004final7', 'styles.css?v=20261004final8')
h = h.replace('app.js?v=20261004final7', 'app.js?v=20261004final8')
h = h.replace('FINAL · 2026.10.04 · 7', 'FINAL · 2026.10.04 · 8')
p.write_text(h)

# 3) CSS override for original round format with text-only two lines
p = Path('styles.css')
c = p.read_text()
c += r'''

/* final8 · regular conditions + round text-only Register CODE */
.nav-register{
  position:absolute!important;
  left:50%!important;
  top:-31px!important;
  transform:translateX(-50%)!important;
  width:62px!important;
  height:62px!important;
  min-width:62px!important;
  padding:0!important;
  border-radius:50%!important;
  display:flex!important;
  flex-direction:column!important;
  align-items:center!important;
  justify-content:center!important;
  gap:1px!important;
  background:linear-gradient(145deg,#4bc8ff,#3d8fff)!important;
  color:#f7fbff!important;
  border:4px solid #071018!important;
  box-shadow:0 13px 28px rgba(55,149,255,.34)!important;
  z-index:4!important;
  white-space:normal!important;
  line-height:1!important;
}
.nav-register svg{display:none!important}
.nav-register .register-word,
.nav-register .code-word{
  display:block!important;
  margin:0!important;
  padding:0!important;
  color:inherit!important;
  font-size:9px!important;
  line-height:1.05!important;
  font-weight:850!important;
  letter-spacing:.02em!important;
  text-transform:none!important;
}
.nav-register .code-word{
  font-size:10px!important;
  letter-spacing:.08em!important;
}
.nav-register:active{transform:translateX(-50%) scale(.96)!important}
@media(max-width:520px){
  .nav-register{width:60px!important;height:60px!important;min-width:60px!important;top:-30px!important}
  .nav-register .register-word{font-size:8.5px!important}
  .nav-register .code-word{font-size:9.5px!important}
}
'''
p.write_text(c)

# Optional index cache-bust if present
idx = Path('index.html')
if idx.exists():
    t = idx.read_text()
    t = t.replace('20261004final7', '20261004final8')
    idx.write_text(t)
