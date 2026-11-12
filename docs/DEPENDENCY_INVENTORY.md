# DEPENDENCY_INVENTORY — DhaherOS (repo A, Python)

**AT-27 (light inventory, format-neutral — SBOM final menunggu DL-27)**

- **Tanggal pencatatan:** 2026-11-12, ~10:36 WIB (Asia/Jakarta) — sandbox `dhaheros-sandbox`
- **Dibuat oleh:** task 58-a (docs-sync), mandate pemilik 2026-11-12
- **Sifat:** inventory ringan (light) berbasis output perintah yang benar-benar dijalankan di sandbox ini. Format netral; SBOM final (mis. CycloneDX/SPDX) menunggu task DL-27.

## Lingkungan efektif

- **Venv repo-lokal tidak ada:** `DhaherOS/.venv`, `DhaherOS/venv`, `DhaherOS/env` dicek dengan `ls` — ketiganya tidak ada. Freeze diambil dari interpreter `python3` yang efektif di PATH sandbox:
  - `sys.executable` → `/home/z/.venv/bin/python3` (venv global sandbox, bukan repo-lokal)
  - `sys.prefix` → `/home/z/.venv`

## Perintah yang benar-benar dijalankan (2026-11-12 ~10:36 WIB)

| Perintah | Output |
|---|---|
| `python3 --version` | `Python 3.12.16` |
| `python3 -m pip --version` | `pip 26.2.2 from /home/z/.venv/lib/python3.12/site-packages/pip (python 3.12)` |
| `python3 -m pip freeze 2>/dev/null \| wc -l` | `429` paket |
| `python3 -c "import pytest; print(pytest.__version__)"` | `pytest 9.0.2` |
| `python3 -c "import sys; print(sys.executable, sys.prefix)"` | `/home/z/.venv/bin/python3 /home/z/.venv` |

## requirements.txt (repo A) vs versi terpasang di env aktif

Isi `/home/z/my-project/DhaherOS/requirements.txt` (11 entri):

| Paket | Pin requirements.txt | Terpasang (env aktif) | Status |
|---|---|---|---|
| pydantic | `>=2,<3` | 2.12.5 | ✅ memenuhi pin |
| requests | `>=2.31` | 2.32.5 | ✅ |
| numpy | `>=1.24` | 2.1.3 | ✅ |
| httpx | `>=0.25` | 0.28.1 | ✅ |
| aiohttp | `>=3.9` | 3.13.3 | ✅ |
| sqlalchemy | `>=2.0` | — (tidak terpasang) | ⚠️ gap: `import sqlalchemy` → ModuleNotFoundError |
| pyyaml | `>=6.0` | 6.0.3 | ✅ |
| python-dotenv | `>=1.0` | 1.2.2 | ✅ |
| websockets | `>=12.0` | 16.0 | ✅ |
| yfinance | `>=0.2.30` | — (tidak terpasang) | ⚠️ gap: `import yfinance` → ModuleNotFoundError |
| pandas | `>=2.0.0` | 2.2.3 | ✅ |

**Gap dicatat jujur:** `sqlalchemy` dan `yfinance` dideklarasikan di requirements.txt tetapi TIDAK terpasang di env aktif sandbox (`python3 -c "import sqlalchemy"` / `import yfinance` → ModuleNotFoundError, dicek 2026-11-12 ~10:38 WIB).

## Testing tooling

- `pytest` 9.0.2 (terpasang, `python3 -c "import pytest"`)
- Plugin pytest terpasang: pytest-asyncio 1.3.0, pytest-cov 7.0.0, pytest-json-report 1.5.0, pytest-metadata 3.1.1
- `coverage` 7.13.1; `ruff` tidak ada di freeze (lint via `pyproject.toml`/tool lain — tidak diverifikasi di inventory ini)

## Daftar lengkap pip freeze (429 paket)

Sumber: `python3 -m pip freeze 2>/dev/null | sort` (daftar persis seperti output perintah, diurutkan alfabetis), diambil 2026-11-12 ~10:36 WIB dari env `/home/z/.venv`.

<details>
<summary>klik untuk membuka daftar 429 paket</summary>

```
APScheduler==3.11.2
Authlib==1.6.9
CairoSVG==2.8.2
Deprecated==1.3.1
Faker==40.1.2
Hypercorn==0.18.0
ImageIO==2.37.3
Jinja2==3.1.6
MarkupSafe==3.0.3
PyJWT==2.12.1
PyMuPDF==1.26.7
PyPDF2==3.0.1
PyYAML==6.0.3
Pygments==2.20.0
RapidFuzz==3.14.3
SecretStorage==3.5.0
Send2Trash==2.1.0
adjustText==1.4.0
affine==2.4.0
aiofiles==24.1.0
aiohappyeyeballs==2.6.1
aiohttp==3.13.3
aiosignal==1.4.0
alibabacloud-credentials-api==1.0.0
alibabacloud-credentials==1.0.8
alibabacloud-fc20230330==4.6.7
alibabacloud-oss-v2==1.2.2
alibabacloud-polardb20170801==6.5.0
alibabacloud-tea-openapi==0.4.4
alibabacloud-tea-util==0.3.14
alibabacloud-tea==0.4.3
alibabacloud_gateway_spi==0.0.3
annotated-doc==0.0.4
annotated-types==0.7.0
anyio==4.13.0
anytree==2.13.0
argon2-cffi-bindings==25.1.0
argon2-cffi==25.1.0
arrow==1.4.0
asn1crypto==1.5.1
aspose-words==26.1.0
asttokens==3.0.1
async-lru==2.3.0
attrs==26.1.0
audioread==3.1.0
babel==2.18.0
beartype==0.22.9
beautifulsoup4==4.14.3
biopython==1.86
bleach==4.1.0
blis==1.3.3
blosc2==4.1.2
bokeh==3.8.2
boto3==1.42.85
botocore==1.42.86
branca==0.8.2
brotli==1.2.0
bytecode==0.17.0
cachetools==7.0.5
cadquery-ocp==7.8.1.1.post1
cadquery==2.6.1
cairocffi==1.7.1
camelot-py==0.11.0
casadi==3.7.2
catalogue==2.0.10
catboost==1.2.8
cattrs==26.1.0
certifi==2026.2.25
cffi==2.0.0
chardet==5.2.0
charset-normalizer==3.4.7
choreographer==1.4.0
click-plugins==1.1.1.2
click==8.1.8
cligj==0.7.2
cloudpathlib==0.23.0
cloudpickle==3.1.2
cmudict==1.1.3
cobble==0.1.4
comm==0.2.3
confection==0.1.5
contourpy==1.3.3
countryinfo==0.1.2
coverage==7.13.1
crcmod-plus==2.3.1
cronsim==2.7
cryptography==44.0.3
cssselect2==0.9.0
cycler==0.12.1
cyclopts==4.10.2
cymem==2.0.13
darabonba-core==1.0.5
databricks-sql-connector==4.2.4
datadog==0.52.1
ddtrace==4.2.2
debugpy==1.8.20
decorator==5.2.1
defusedxml==0.7.1
diskcache==5.6.3
distro==1.9.0
dnspython==2.8.0
docstring_parser==0.17.0
docutils==0.22.4
docx2txt==0.9
einops==0.8.1
email-validator==2.3.0
envier==0.6.1
et_xmlfile==2.0.0
exceptiongroup==1.3.1
exchange_calendars==4.12
executing==2.2.1
ezdxf==1.4.3
fakeredis==2.34.1
fastapi==0.128.0
fastjsonschema==2.21.2
fastmcp==2.14.3
ffmpeg-python==0.2.0
ffmpy==1.0.0
filelock==3.25.2
fiona==1.10.1
folium==0.20.0
fonttools==4.62.1
fpdf2==2.8.5
fqdn==1.5.1
freetype-py==2.5.1
frozenlist==1.8.0
fsspec==2026.3.0
future==1.0.0
fuzzywuzzy==0.18.0
gTTS==2.5.4
gensim==4.4.0
geographiclib==2.1
geopandas==1.1.2
geopy==2.4.1
gradio==6.3.0
gradio_client==2.0.3
graphviz==0.21
greenlet==3.4.0
groovy==0.1.2
h11==0.16.0
h2==4.3.0
h5py==3.15.1
hf-xet==1.4.3
hpack==4.1.0
html5lib==1.1
httpcore==1.0.9
httpx-sse==0.4.3
httpx==0.28.1
huggingface_hub==1.9.2
hyperframe==6.1.0
idna==3.11
imageio-ffmpeg==0.6.0
imbalanced-learn==0.12.4
imgkit==1.2.3
importlib_metadata==8.7.1
importlib_resources==6.5.2
iniconfig==2.3.0
ipykernel==7.2.0
ipython==9.12.0
ipython_pygments_lexers==1.1.1
isoduration==20.11.0
jaraco.classes==3.4.0
jaraco.context==6.1.2
jaraco.functools==4.4.0
jedi==0.19.2
jeepney==0.9.0
jmespath==1.1.0
joblib==1.5.3
json5==0.14.0
json_repair==0.59.10
jsonpointer==3.1.1
jsonschema-path==0.4.5
jsonschema-specifications==2025.9.1
jsonschema==4.26.0
jupyter-events==0.12.0
jupyter-lsp==2.3.1
jupyter_client==8.8.0
jupyter_core==5.9.1
jupyter_server==2.17.0
jupyter_server_terminals==0.5.4
jupyterlab==4.5.2
jupyterlab_pygments==0.3.0
jupyterlab_server==2.28.0
kaleido==1.5.0
kerykeion==5.6.3
keyring==25.7.0
kiwisolver==1.5.0
korean-lunar-calendar==0.3.1
lark==1.3.1
lazy-loader==0.5
librosa==0.10.2.post1
lightgbm==4.5.0
llvmlite==0.44.0
logistro==2.0.1
loguru==0.7.3
lupa==2.7
lxml==6.0.2
lz4==4.4.5
mammoth==1.11.0
markdown-it-py==4.0.0
markdownify==1.2.2
matplotlib-inline==0.2.1
matplotlib-venn==1.1.2
matplotlib==3.9.2
mcp==1.27.0
mdurl==0.1.2
mistune==3.2.0
mizani==0.14.4
mne==1.11.0
more-itertools==11.0.1
moviepy==2.2.1
mpmath==1.3.0
msgpack==1.1.2
multidict==6.7.1
multimethod==1.12
murmurhash==1.0.15
mutagen==1.47.0
narwhals==2.19.0
nashpy==0.0.43
nbclient==0.10.4
nbconvert==7.17.1
nbformat==5.10.4
ndindex==1.10.1
nest-asyncio==1.6.0
networkx==3.6.1
nlopt==2.10.0
nltk==3.9.2
notebook==7.5.2
notebook_shim==0.2.4
numba==0.61.0
numexpr==2.14.1
numpy-financial==1.0.0
numpy==2.1.3
nvidia-nccl-cu12==2.29.7
oauthlib==3.3.1
odfpy==1.4.1
openapi-pydantic==0.5.1
opencv-python-headless==4.13.0.90
openpyxl==3.1.5
opentelemetry-api==1.40.0
orjson==3.11.8
packaging==26.0
pandas==2.2.3
pandoc==2.4
pandocfilters==1.5.1
parso==0.8.6
path==17.1.1
pathable==0.5.0
pathvalidate==3.3.1
patsy==1.0.2
pdf2image==1.17.0
pdfkit==1.0.0
pdfminer.six==20251230
pdfplumber==0.11.9
pdfrw==0.4
pedalboard==0.9.21
pexpect==4.9.0
pikepdf==10.18.0
pillow==11.3.0
platformdirs==4.9.6
playwright==1.57.0
plotly==6.5.2
plotnine==0.15.2
pluggy==1.6.0
plumbum==1.10.0
ply==3.11
pooch==1.9.0
preshed==3.0.13
priority==2.0.0
proglog==0.1.12
prometheus_client==0.24.1
prompt_toolkit==3.0.52
pronouncing==0.2.0
propcache==0.4.1
psutil==7.2.2
ptyprocess==0.7.0
pure_eval==0.2.3
py-cpuinfo==9.0.0
py-key-value-aio==0.3.0
py-key-value-shared==0.3.0
pyOpenSSL==25.1.0
pybreaker==1.4.1
pycairo==1.29.0
pycountry==24.6.1
pycparser==3.0
pycryptodome==3.23.0
pydantic-settings==2.13.1
pydantic==2.12.5
pydantic_core==2.41.5
pydocket==0.18.2
pydot==4.0.1
pydub==0.25.1
pydyf==0.12.1
pyee==13.0.1
pyloudnorm==0.2.0
pyluach==2.3.0
pyogrio==0.12.1
pypandoc==1.16.2
pyparsing==3.3.2
pypdf==6.6.0
pypdfium2==5.7.0
pyperclip==1.11.0
pyphen==0.17.2
pyproj==3.7.2
pyswisseph==2.10.3.2
pytesseract==0.3.13
pytest-asyncio==1.3.0
pytest-cov==7.0.0
pytest-json-report==1.5.0
pytest-metadata==3.1.1
pytest==9.0.2
pyth3==0.7
python-dateutil==2.9.0.post0
python-docx==1.2.0
python-dotenv==1.2.2
python-json-logger==4.1.0
python-multipart==0.0.24
python-pptx==1.0.2
pyttsx3==2.99
pytz==2026.1.post1
pyxlsb==1.0.10
pyzbar==0.1.9
pyzmq==27.1.0
qrcode==8.2
rarfile==4.2
rasterio==1.5.0
rdflib==7.5.0
redis==7.4.0
referencing==0.37.0
regex==2026.4.4
reportlab==4.4.9
requests-cache==1.3.1
requests==2.32.5
rfc3339-validator==0.1.4
rfc3986-validator==0.1.1
rfc3987-syntax==1.1.0
rich-rst==1.3.2
rich==14.3.3
ripgrepy @ git+https://github.com/callmemhz/ripgrepy@7ae3ad2168b3dc79c7ef373e7cbf0dce47e050a8
rlPyCairo==0.4.0
rpds-py==0.30.0
s3transfer==0.16.0
safehttpx==0.1.7
scikit-image==0.24.0
scikit-learn==1.5.2
scipy==1.14.1
scour==0.38.2
seaborn==0.13.2
semantic-version==2.10.0
setuptools==82.0.1
shapely==2.1.2
shellingham==1.5.4
simple-ascii-tables==1.0.1
simplejson==4.2.0
six==1.17.0
smart_open==7.5.1
snowflake-connector-python==4.2.0
sortedcontainers==2.4.0
soundfile==0.13.1
soupsieve==2.8.3
soxr==1.0.0
spacy-legacy==3.0.12
spacy-loggers==1.0.5
spacy==3.8.11
squarify==0.4.5
srsly==2.5.3
srt==3.5.3
sse-starlette==3.3.4
stack-data==0.6.3
starlette==0.50.0
statsmodels==0.14.5
svglib==1.6.0
svgwrite==1.4.3
sympy==1.14.0
tables==3.10.2
tabula-py==2.10.0
tabulate==0.9.0
terminado==0.18.1
textblob==0.19.0
thinc==8.3.11
threadpoolctl==3.6.0
thrift==0.20.0
tifffile==2026.3.3
tinycss2==1.5.1
tinyhtml5==2.1.0
tomlkit==0.13.3
toolz==1.1.0
tornado==6.5.5
tqdm==4.67.1
traitlets==5.14.3
trame-client==3.11.4
trame-common==1.1.3
trame-server==3.10.0
trame-vtk==2.11.6
trame==3.12.0
trimesh==4.11.1
typer-slim==0.23.1
typer==0.23.1
typing-inspection==0.4.2
typing_extensions==4.15.0
typish==1.9.3
tzdata==2026.1
tzlocal==5.3.1
uncalled-for==0.3.1
uri-template==1.3.0
url-normalize==2.2.1
urllib3==2.6.3
uvicorn==0.44.0
vtk==9.3.1
wasabi==1.1.3
wcwidth==0.6.0
weasel==0.4.3
weasyprint==68.0
webcolors==25.10.0
webencodings==0.5.1
websocket-client==1.9.0
websockets==16.0
wordcloud==1.9.6
wrapt==2.1.2
wslink==2.5.6
wsproto==1.3.2
xgboost==2.1.3
xlrd==2.0.2
xlsxwriter==3.2.9
xlwt==1.3.0
xyzservices==2026.3.0
yarl==1.23.0
zipp==3.23.0
zopfli==0.4.1
```

</details>

---

*File ini bukan bukti implementasi; hanya snapshot dependency env sandbox pada tanggal di atas. Jangan edit verify_at.sh/EVIDENCE.md/PROGRESS.md berdasarkan file ini.*
