"""Regenera la entrega usando capturas e informes reales, sin fabricar evidencias."""
from pathlib import Path
import json
from xml.sax.saxutils import escape
from reportlab.pdfgen import canvas
from reportlab.lib.colors import HexColor, white
from reportlab.lib.utils import ImageReader
from reportlab.platypus import Paragraph
from reportlab.lib.styles import ParagraphStyle

ROOT = Path(__file__).resolve().parent
LINKS = json.loads((ROOT / 'enlaces.json').read_text(encoding='utf-8'))
OUT = ROOT / 'Hotel_Aurora.pdf'
W, H = 841.89, 595.28  # A4 horizontal, espacio para capturas legibles
c = canvas.Canvas(str(OUT), pagesize=(W, H))
c.setTitle('Hotel Aurora - Entrega universitaria y evidencias E2E')
c.setAuthor('Proyecto universitario Hotel Aurora')
NAVY, GOLD = HexColor('#142d43'), HexColor('#aa8448')
style = ParagraphStyle('body', fontName='Helvetica', fontSize=13, leading=21, textColor=NAVY)
page = 0

def base(title, subtitle=''):
    global page
    page += 1
    c.setFillColor(NAVY); c.rect(0, H-83, W, 83, fill=1, stroke=0)
    c.setFillColor(white); c.setFont('Helvetica-Bold', 23); c.drawString(36, H-39, title)
    c.setFont('Helvetica', 11); c.drawString(36, H-63, subtitle)
    c.setFillColor(GOLD); c.setFont('Helvetica', 9)
    c.drawString(36, 20, 'HOTEL AURORA | Evidencias de ejecución real')
    c.drawRightString(W-36, 20, str(page))

def para(text, y, size=None):
    use_style = style if size is None else ParagraphStyle('small', parent=style, fontSize=size, leading=size+7)
    p = Paragraph(text, use_style); _, height = p.wrap(W-80, H)
    p.drawOn(c, 40, y-height)
    return y-height-17

def link(label, url, y):
    return para(f'<b>{escape(label)}</b><br/><link href="{escape(url)}" color="#35658a">{escape(url)}</link>', y, 12)

def shot(filename, title, subtitle):
    path = ROOT / 'evidencias' / filename
    if not path.exists():
        raise FileNotFoundError(f'Falta evidencia requerida: {path}')
    base(title, subtitle)
    img = ImageReader(str(path)); iw, ih = img.getSize()
    scale = min((W-60)/iw, (H-122)/ih)
    width, height = iw*scale, ih*scale
    c.drawImage(img, (W-width)/2, 38+(H-122-height)/2, width=width, height=height)
    c.showPage()

base('Hotel Aurora', 'Sistema de reservas de hotel | Aplicación, pruebas y entrega universitaria')
y = para('Una aplicación pequeña y funcional: habitaciones, fechas, huéspedes, cálculo del total y reservas persistidas en SQLite. Interfaz y documentación en español.', H-115)
y = link('Repositorio público', LINKS['repository_url'], y)
if LINKS.get('actions_url'):
    y = link('GitHub Actions - ejecución exitosa comprobada', LINKS['actions_url'], y)
else:
    y = para('PENDIENTE: todavía no hay una ejecución exitosa de GitHub Actions verificada.', y)
if LINKS.get('video_url'):
    y = link('Video demostrativo del estudiante', LINKS['video_url'], y)
else:
    y = para('<b>VIDEO PENDIENTE</b><br/>Grabar y publicar una demostración de máximo 3 minutos. Añadir el enlace en entrega/enlaces.json y ejecutar python entrega/generar_pdf.py.', y)
para('Apoyo declarado: ChatGPT y Codex para desarrollo, pruebas y documentación. El estudiante debe revisar y explicar la solución.', y, 11)
c.showPage()

base('Arquitectura y datos', 'HTML / CSS / JavaScript -> Express -> SQLite')
y = para('<b>Componentes reales.</b> La interfaz llama a una API REST. El servidor valida datos, obtiene la tarifa de la habitación y calcula noches y total. Genera un UUID y lo inserta con consultas preparadas.', H-110)
y = para('<b>Sin reservas duplicadas.</b> Se comprueban intervalos superpuestos dentro de una transacción BEGIN IMMEDIATE. Un trigger agrega una segunda protección. Las reservas contiguas se permiten; las habitaciones fuera de servicio se rechazan.', y)
y = para('<b>Reinicio antes de cada prueba.</b> beforeEach verifica el modo test y llama a POST /api/test/reset. Una transacción borra reservas y carga las mismas tres habitaciones. El endpoint solo existe al arrancar con --test.', y)
y = para('<b>Bases separadas.</b> data/hotel.sqlite para uso normal (puerto 4310) y data/hotel-test.sqlite para Cypress (4311). La prueba de API reinicia el proceso y vuelve a consultar la reserva para comprobar persistencia en disco.', y)
para('<b>Lo único simulado.</b> Cypress responde una vez con HTTP 500. Ese intento no se guarda. El reintento llega a Express y escribe en SQLite.', y)
c.showPage()

shot('01-formulario-completo.png', 'Recorrido 1 · Formulario completo', 'Habitación disponible, fechas futuras, dos huéspedes, tres noches y USD 255.')
shot('02-reserva-exitosa.png', 'Recorrido 1 · Reserva persistida', 'HTTP 201, identificador único y consulta de la API con comparación de todos los campos.')
shot('03-validacion-fechas.png', 'Recorrido 2 · Validación', 'Salida anterior a la entrada: mensaje visible, cero POST de creación y cero reservas nuevas.')
shot('04-error-500.png', 'Recorrido 3 · Error controlado', 'cy.intercept simula HTTP 500 una sola vez; las fechas, los huéspedes y el total se conservan.')
shot('05-recuperacion-exitosa.png', 'Recorrido 3 · Recuperación', 'El segundo intento usa la API real y guarda la reserva con un nuevo identificador.')
shot('06-resultado-cypress.jpg', 'Resultados de Cypress', 'Informe de resultados reales. Los archivos JSON originales acompañan esta entrega.')
if LINKS.get('actions_url'):
    shot('07-github-actions.jpg', 'Integración continua · GitHub Actions', 'Ejecución exitosa verificada en GitHub; enlace directo en la primera página.')

base('Independencia y estabilidad', 'Sin pausas fijas ni dependencia del orden de ejecución')
y = H-110
for mode in ['normal', 'inverso']:
    data = json.loads((ROOT / 'evidencias' / f'cypress-{mode}.json').read_text(encoding='utf-8'))
    results = data['results']
    y = para(f'<b>Orden {mode}.</b> ' + ' -> '.join(r['spec'] for r in results) + f".<br/>Resultado real: {sum(r['passed'] for r in results)} aprobadas, {sum(r['failed'] for r in results)} fallidas. Registro UTC: {data['generatedAt']}", y, 12)
y = para('Cada prueba parte del mismo seed y usa fechas relativas futuras. Los selectores data-cy son independientes de la presentación. Las aserciones esperan condiciones y los alias esperan respuestas de red: @rooms, @create, @failure y @retry. No se usa cy.wait con tiempos numéricos.', y)
y = para('El workflow instala dependencias con npm ci, valida TypeScript y API, prepara SQLite y ejecuta los dos órdenes. Conserva capturas, videos y registros como artifacts incluso ante fallos. Los videos automáticos de Cypress no sustituyen el video narrado del estudiante.', y)
para('Para actualizar esta entrega: modificar entrega/enlaces.json y volver a ejecutar el generador. Guion de 2:45 disponible en entrega/guion_video.md.', y, 12)
c.showPage(); c.save()
print(f'PDF creado: {OUT} ({page} páginas)')
