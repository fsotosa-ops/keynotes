#!/usr/bin/env python3
"""Arma la versión pública de una charla en publico/<charla>/.
Quita las notas del presentador y copia solo los archivos que el deck usa.
Uso: python3 scripts/publicar.py 2026-11-ia-trabajo-real
"""
import re, shutil, sys
from pathlib import Path

RAIZ = Path(__file__).resolve().parent.parent
charla = sys.argv[1]
origen = RAIZ / 'talks' / charla / 'deck'
destino = RAIZ / 'publico' / charla
if destino.exists(): shutil.rmtree(destino)
(destino / 'media').mkdir(parents=True)

html = (origen / 'index.html').read_text()
html = re.sub(r'\sdata-notas="[^"]*"', '', html)                     # sin guiones
html = re.sub(r'<!--.*?-->', '', html, flags=re.S)                    # sin comentarios
fuentes = ('<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>'
           '<link href="https://fonts.googleapis.com/css2?family=Geist:wght@400;500;600;700&family=Geist+Mono:wght@400;600&display=swap" rel="stylesheet">')
html = html.replace('<link rel="stylesheet" href="deck.css">', fuentes + '\n<link rel="stylesheet" href="deck.css">', 1)
html = html.replace('<title>Crear software con IA</title>', '<title>La diferencia es saber qué y cómo construir · Felipe Soto</title>\n<meta name="description" content="Keynote: con IA, cualquiera puede construir; la diferencia es saber qué y cómo construir. El caso de la Fundación Summer.">')
(destino / 'index.html').write_text(html)

archivos = ['deck.css', 'deck-v5.css', 'deck-v6.css', 'iconos.js', 'deck.js']
for a in archivos: shutil.copy2(origen / a, destino / a)
js = (destino / 'deck.js').read_text()
js = re.sub(r"\n\s*else if \(e\.key\.toLowerCase\(\) === 'p'\)[^\n]*", '', js)   # sin vista del presentador
(destino / 'deck.js').write_text(js)
textos = html + ''.join((origen / a).read_text() for a in archivos)
medios = sorted(set(re.findall(r'media/[A-Za-z0-9._-]+', textos)))
for m in medios: shutil.copy2(origen / m, destino / m)

restos = re.findall(r'data-notas|crear-proyecto|sumakit', (destino / 'index.html').read_text())
print(f'{len(medios)} medios copiados · restos sensibles: {restos or "ninguno"}')
