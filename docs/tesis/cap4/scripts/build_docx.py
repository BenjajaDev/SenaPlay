"""Inserta el Capítulo IV (capitulo-4.md) en una copia desempaquetada del .docx de la tesis.

Reemplaza solo los marcadores grises del Capítulo IV, conserva los títulos (y sus
marcadores de la tabla de contenidos) y replica los formatos del Capítulo III:
párrafo de cuerpo, rótulos con campos SEQ, tablas, figuras, fuentes y código.

Uso: python build_docx.py <dir_desempaquetado> <capitulo-4.md> <dir_base_figuras>
"""
import re
import struct
import sys
from pathlib import Path
from xml.sax.saxutils import escape

UNPACKED, CHAPTER, FIG_BASE = (Path(a) for a in sys.argv[1:4])
DOC = UNPACKED / "word" / "document.xml"
RELS = UNPACKED / "word" / "_rels" / "document.xml.rels"
SETTINGS = UNPACKED / "word" / "settings.xml"
MEDIA = UNPACKED / "word" / "media"

TEXT_WIDTH_DXA = 7704
EMU_PER_INCH = 914400
MAX_HEIGHT_IN = 7.4

counters = {"Tabla": 11, "Figura": 4, "Código": 0}
state = {"bookmark": 2000, "docpr": 1300000000, "rid": 100, "image": 100}


def t(text):
    return f'<w:t xml:space="preserve">{escape(text)}</w:t>'


def runs(text, base_rpr=""):
    """Convierte **negrita** y *cursiva* en runs de Word."""
    out = []
    for token in re.split(r"(\*\*[^*]+\*\*|\*[^*]+\*)", text):
        if not token:
            continue
        rpr = base_rpr
        if token.startswith("**"):
            rpr += "<w:b/><w:bCs/>"
            token = token[2:-2]
        elif token.startswith("*"):
            rpr += "<w:i/><w:iCs/>"
            token = token[1:-1]
        out.append(f"<w:r>{f'<w:rPr>{rpr}</w:rPr>' if rpr else ''}{t(token)}</w:r>")
    return "".join(out)


def body(text):
    return ('<w:p><w:pPr><w:spacing w:after="240" w:line="360" w:lineRule="auto"/><w:jc w:val="both"/></w:pPr>'
            f"{runs(text)}</w:p>")


def caption(kind, title):
    counters[kind] += 1
    n = counters[kind]
    state["bookmark"] += 1
    bid = state["bookmark"]
    b = "<w:b/><w:bCs/><w:sz w:val=\"22\"/><w:szCs w:val=\"22\"/>"
    return ('<w:p><w:pPr><w:keepNext/><w:keepLines/><w:spacing w:before="240" w:after="120"/><w:jc w:val="center"/></w:pPr>'
            f'<w:bookmarkStart w:id="{bid}" w:name="_Toc9{bid:08d}"/>'
            f'<w:r><w:rPr>{b}</w:rPr>{t(kind + " ")}<w:fldChar w:fldCharType="begin"/></w:r>'
            f'<w:r><w:rPr>{b}</w:rPr><w:instrText xml:space="preserve"> SEQ {kind} \\* ARABIC </w:instrText></w:r>'
            f'<w:r><w:rPr>{b}</w:rPr><w:fldChar w:fldCharType="separate"/></w:r>'
            f'<w:r><w:rPr><w:b/><w:bCs/><w:noProof/><w:sz w:val="22"/><w:szCs w:val="22"/></w:rPr>{t(str(n))}</w:r>'
            f'<w:r><w:rPr>{b}</w:rPr><w:fldChar w:fldCharType="end"/>{t(". ")}</w:r>'
            f'<w:r><w:rPr><w:sz w:val="22"/><w:szCs w:val="22"/></w:rPr>{t(title)}</w:r>'
            f'<w:bookmarkEnd w:id="{bid}"/></w:p>')


def source(text):
    return ('<w:p><w:pPr><w:spacing w:before="80" w:after="300"/><w:jc w:val="center"/></w:pPr>'
            f'<w:r><w:rPr><w:sz w:val="20"/><w:szCs w:val="20"/></w:rPr>{t(text)}</w:r></w:p>')


def pending(text):
    return ('<w:p><w:pPr><w:shd w:val="clear" w:color="auto" w:fill="FFF2CC"/><w:spacing w:after="240" w:line="300" w:lineRule="auto"/><w:jc w:val="both"/></w:pPr>'
            f'<w:r><w:rPr><w:i/><w:iCs/><w:color w:val="7F6000"/></w:rPr>{t("[" + text + "]")}</w:r></w:p>')


CELL_BORDERS = ('<w:tcBorders>' + "".join(
    f'<w:{s} w:val="single" w:sz="4" w:space="0" w:color="808080"/>' for s in ("top", "left", "bottom", "right")) + '</w:tcBorders>')
CELL_MAR = ('<w:tcMar><w:top w:w="50" w:type="dxa"/><w:left w:w="90" w:type="dxa"/>'
            '<w:bottom w:w="50" w:type="dxa"/><w:right w:w="90" w:type="dxa"/></w:tcMar>')


def table(title, src, widths, rows):
    if sum(widths) != TEXT_WIDTH_DXA:
        raise ValueError(f"Anchos de «{title}» suman {sum(widths)}, no {TEXT_WIDTH_DXA}")
    grid = "".join(f'<w:gridCol w:w="{w}"/>' for w in widths)
    xml_rows = []
    for i, row in enumerate(rows):
        if len(row) != len(widths):
            raise ValueError(f"Fila con {len(row)} celdas en «{title}»: {row}")
        header = i == 0
        cells = []
        for w, cell in zip(widths, row):
            shd = '<w:shd w:val="clear" w:color="auto" w:fill="E7E3F0"/>' if header else ""
            rpr = '<w:sz w:val="19"/><w:szCs w:val="19"/>' + ("<w:b/><w:bCs/>" if header else "")
            cells.append(f'<w:tc><w:tcPr><w:tcW w:w="{w}" w:type="dxa"/>{CELL_BORDERS}{shd}{CELL_MAR}<w:vAlign w:val="center"/></w:tcPr>'
                         f'<w:p>{runs(cell, rpr)}</w:p></w:tc>')
        trpr = '<w:trPr><w:cantSplit/><w:tblHeader/></w:trPr>' if header else '<w:trPr><w:cantSplit/></w:trPr>'
        xml_rows.append(f"<w:tr>{trpr}{''.join(cells)}</w:tr>")
    borders = "".join(f'<w:{s} w:val="single" w:sz="4" w:space="0" w:color="auto"/>'
                      for s in ("top", "left", "bottom", "right", "insideH", "insideV"))
    tbl = (f'<w:tbl><w:tblPr><w:tblW w:w="{TEXT_WIDTH_DXA}" w:type="dxa"/><w:tblBorders>{borders}</w:tblBorders>'
           '<w:tblCellMar><w:left w:w="10" w:type="dxa"/><w:right w:w="10" w:type="dxa"/></w:tblCellMar>'
           '<w:tblLook w:val="04A0" w:firstRow="1" w:lastRow="0" w:firstColumn="1" w:lastColumn="0" w:noHBand="0" w:noVBand="1"/></w:tblPr>'
           f"<w:tblGrid>{grid}</w:tblGrid>{''.join(xml_rows)}</w:tbl>")
    return caption("Tabla", title) + tbl + source(src)


def png_size(path):
    with open(path, "rb") as f:
        head = f.read(24)
    return struct.unpack(">II", head[16:24])


rels_added = []


def figure(title, src, path, width_in):
    img = FIG_BASE / path
    w_px, h_px = png_size(img)
    width_in = min(width_in, TEXT_WIDTH_DXA / 1440)
    height_in = width_in * h_px / w_px
    if height_in > MAX_HEIGHT_IN:
        width_in *= MAX_HEIGHT_IN / height_in
        height_in = MAX_HEIGHT_IN
    cx, cy = int(width_in * EMU_PER_INCH), int(height_in * EMU_PER_INCH)
    state["image"] += 1
    state["rid"] += 1
    state["docpr"] += 1
    name = f"image{state['image']}.png"
    (MEDIA / name).write_bytes(img.read_bytes())
    rid = f"rId{state['rid']}"
    rels_added.append(f'<Relationship Id="{rid}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="media/{name}"/>')
    drawing = (
        f'<w:drawing><wp:inline distT="0" distB="0" distL="0" distR="0"><wp:extent cx="{cx}" cy="{cy}"/>'
        '<wp:effectExtent l="0" t="0" r="0" b="0"/>'
        f'<wp:docPr id="{state["docpr"]}" name="Figura {counters["Figura"] + 1}"/>'
        '<wp:cNvGraphicFramePr><a:graphicFrameLocks xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" noChangeAspect="1"/></wp:cNvGraphicFramePr>'
        '<a:graphic xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"><a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/picture">'
        '<pic:pic xmlns:pic="http://schemas.openxmlformats.org/drawingml/2006/picture"><pic:nvPicPr>'
        f'<pic:cNvPr id="0" name="{name}"/><pic:cNvPicPr><a:picLocks noChangeAspect="1" noChangeArrowheads="1"/></pic:cNvPicPr></pic:nvPicPr>'
        f'<pic:blipFill><a:blip r:embed="{rid}"/><a:srcRect/><a:stretch><a:fillRect/></a:stretch></pic:blipFill>'
        f'<pic:spPr bwMode="auto"><a:xfrm><a:off x="0" y="0"/><a:ext cx="{cx}" cy="{cy}"/></a:xfrm>'
        '<a:prstGeom prst="rect"><a:avLst/></a:prstGeom></pic:spPr></pic:pic></a:graphicData></a:graphic></wp:inline></w:drawing>')
    pic = f'<w:p><w:pPr><w:keepNext/><w:jc w:val="center"/></w:pPr><w:r><w:rPr><w:noProof/></w:rPr>{drawing}</w:r></w:p>'
    return caption("Figura", title) + pic + source(src)


def figure_pending(title, note):
    return caption("Figura", title) + pending(note)


def code(title, src, lines):
    box = "".join(f'<w:{s} w:val="single" w:sz="4" w:space="4" w:color="BFBFBF"/>' for s in ("top", "left", "bottom", "right"))
    paras = []
    for i, line in enumerate(lines):
        keep = "<w:keepNext/>" if i < len(lines) - 1 else ""
        paras.append(f'<w:p><w:pPr>{keep}<w:keepLines/><w:pBdr>{box}</w:pBdr><w:shd w:val="clear" w:color="auto" w:fill="F5F5F5"/>'
                     '<w:spacing w:after="0" w:line="240" w:lineRule="auto"/><w:ind w:left="113" w:right="113"/></w:pPr>'
                     '<w:r><w:rPr><w:rFonts w:ascii="Consolas" w:hAnsi="Consolas" w:cs="Consolas"/><w:noProof/><w:sz w:val="15"/><w:szCs w:val="15"/></w:rPr>'
                     f"{t(line if line else ' ')}</w:r></w:p>")
    return caption("Código", title) + "".join(paras) + source(src)


def render(block_text):
    out, lines, i = [], block_text.split("\n"), 0
    para = []

    def flush():
        if para:
            out.append(body(" ".join(para)))
            para.clear()

    while i < len(lines):
        line = lines[i]
        if line.startswith("[[TABLA|"):
            flush()
            _, title, src, widths = line[2:-2].split("|")
            rows, i = [], i + 1
            while lines[i] != "[[/TABLA]]":
                rows.append([c.strip() for c in lines[i].strip().strip("|").split(" | ")])
                i += 1
            out.append(table(title, src, [int(w) for w in widths.split(",")], rows))
        elif line.startswith("[[FIGURA|"):
            flush()
            _, title, src, path, width = line[2:-2].split("|")
            out.append(figure(title, src, path, float(width)))
        elif line.startswith("[[FIGURA_PENDIENTE|"):
            flush()
            _, title, note = line[2:-2].split("|")
            out.append(figure_pending(title, note))
        elif line.startswith("[[CODIGO|"):
            flush()
            _, title, src = line[2:-2].split("|")
            code_lines, i = [], i + 1
            while lines[i] != "[[/CODIGO]]":
                code_lines.append(lines[i])
                i += 1
            out.append(code(title, src, code_lines))
        elif line.startswith("[[PENDIENTE|"):
            flush()
            out.append(pending(line[2:-2].split("|", 1)[1]))
        elif not line.strip():
            flush()
        else:
            para.append(line.strip())
        i += 1
    flush()
    return "".join(out)


def heading_start(xml, title):
    """Posición del párrafo de título (estilo Ttulo1), no de su entrada en el índice."""
    for m in re.finditer(r'<w:p [^>]*><w:pPr><w:pStyle w:val="Ttulo1"/>.*?</w:p>', xml, re.S):
        if text_of(m.group(0)) == title:
            return m.start()
    raise ValueError(f"No se encontró el título «{title}»")


def text_of(el):
    return "".join(re.findall(r"<w:t[^>]*>([^<]*)</w:t>", el))


def main():
    sections = {}
    for chunk in re.split(r"^@@", CHAPTER.read_text("utf-8"), flags=re.M)[1:]:
        key, _, content = chunk.partition("\n")
        sections[key.strip()] = content.strip("\n")

    xml = DOC.read_text("utf-8")
    start = heading_start(xml, "CAPÍTULO IV: MARCO OPERATIVO")
    end = heading_start(xml, "9. PRODUCTO Y/O RESULTADO")
    region = xml[start:end]
    paragraphs = re.findall(r"<w:p [^>]*>.*?</w:p>", region, re.S)

    rebuilt, current, used = [], None, set()
    for p in paragraphs:
        style = re.search(r'<w:pStyle w:val="([^"]+)"', p)
        txt = text_of(p)
        if style and style.group(1) in ("Ttulo1", "Ttulo2", "Ttulo3"):
            current = "INTRO" if style.group(1) == "Ttulo1" else txt.split()[0]
            rebuilt.append(p)
        elif txt.startswith("[") and 'w:color w:val="7F7F7F"' in p:
            if current not in sections:
                raise KeyError(f"Sin contenido para la sección {current}")
            rebuilt.append(render(sections[current]))
            used.add(current)
        else:
            rebuilt.append(p)
    missing = set(sections) - used
    if missing:
        raise KeyError(f"Secciones sin marcador en el documento: {missing}")
    xml = xml[:start] + "".join(rebuilt) + xml[end:]
    xml = add_references(xml)
    DOC.write_text(xml, "utf-8")

    rels = RELS.read_text("utf-8")
    RELS.write_text(rels.replace("</Relationships>", "".join(rels_added) + "</Relationships>"), "utf-8")

    settings = SETTINGS.read_text("utf-8")
    if "<w:updateFields" not in settings:
        settings = settings.replace("<w:hdrShapeDefaults", '<w:updateFields w:val="true"/><w:hdrShapeDefaults', 1)
        SETTINGS.write_text(settings, "utf-8")
    print("Tablas 12-%d, Figuras 5-%d, Códigos 1-%d" % (counters["Tabla"], counters["Figura"], counters["Código"]))


def reference(parts):
    """parts: lista de (texto, cursiva)."""
    r = "".join(f'<w:r>{"<w:rPr><w:i/><w:iCs/></w:rPr>" if it else ""}{t(tx)}</w:r>' for tx, it in parts)
    return f'<w:p><w:pPr><w:spacing w:line="480" w:lineRule="auto"/><w:ind w:left="720" w:hanging="720"/></w:pPr>{r}</w:p>'


def insert_after(xml, anchor, new_paragraph):
    i = xml.index(anchor)
    end = xml.index("</w:p>", i) + len("</w:p>")
    return xml[:end] + new_paragraph + xml[end:]


def add_references(xml):
    if "Kruchten, P. B." in xml:
        return xml
    xml = insert_after(xml, "Kirkpatrick, D. L., y Kirkpatrick, J. D. (2006). ", reference([
        ("Kruchten, P. B. (1995). The 4+1 view model of architecture. ", False),
        ("IEEE Software, 12", True), ("(6), 42–50. https://doi.org/10.1109/52.469759", False)]))
    xml = insert_after(xml, "29119-1:2013", reference([
        ("International Organization for Standardization. (2018). ", False),
        ("ISO/IEC/IEEE 29148:2018: Systems and software engineering. Life cycle processes. Requirements engineering", True),
        (". https://www.iso.org/standard/72089.html", False)]))
    xml = insert_after(xml, "World Health Organization. (2021)", reference([
        ("World Wide Web Consortium. (2018). ", False),
        ("Web Content Accessibility Guidelines (WCAG) 2.1", True),
        (". https://www.w3.org/TR/WCAG21/", False)]))
    return xml


if __name__ == "__main__":
    main()
