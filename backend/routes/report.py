import json
from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse, PlainTextResponse
from io import BytesIO
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import inch
from reportlab.lib import colors
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, HRFlowable
from models.supabase_client import get_supabase
from utils.auth import get_current_user

router = APIRouter(prefix="/reports", tags=["reports"])


def _get_review_or_403(review_id: int, user_id: int):
    sb = get_supabase()
    review_res = sb.table("reviews").select("*").eq("id", review_id).execute()
    if not review_res.data:
        raise HTTPException(status_code=404, detail="Review not found")
    review = review_res.data[0]
    proj = sb.table("projects").select("id, project_name").eq("id", review["project_id"]).eq("user_id", user_id).execute()
    if not proj.data:
        raise HTTPException(status_code=403, detail="Forbidden")
    findings_res = sb.table("review_findings").select("*").eq("review_id", review_id).execute()
    review["project_name"] = proj.data[0]["project_name"]
    review["findings"] = findings_res.data
    return review


@router.get("/{review_id}/pdf")
def export_pdf(review_id: int, current_user: dict = Depends(get_current_user)):
    review = _get_review_or_403(review_id, current_user["id"])
    buf = BytesIO()
    doc = SimpleDocTemplate(buf, pagesize=A4, rightMargin=inch * 0.75, leftMargin=inch * 0.75,
                            topMargin=inch, bottomMargin=inch)
    styles = getSampleStyleSheet()
    title_style = ParagraphStyle("title", parent=styles["Title"], textColor=colors.HexColor("#1e293b"), fontSize=20)
    h2 = ParagraphStyle("h2", parent=styles["Heading2"], textColor=colors.HexColor("#334155"))
    body = styles["BodyText"]
    story = []
    story.append(Paragraph("Code-Grammerizer Report", title_style))
    story.append(Paragraph(f"Project: {review['project_name']}", styles["Heading3"]))
    story.append(Paragraph(f"Score: {review['review_score']}/100", styles["Heading3"]))
    story.append(Spacer(1, 0.2 * inch))
    story.append(HRFlowable(width="100%", thickness=1, color=colors.grey))
    story.append(Spacer(1, 0.1 * inch))
    story.append(Paragraph("Summary", h2))
    story.append(Paragraph(review.get("summary") or "N/A", body))
    story.append(Spacer(1, 0.15 * inch))
    if review["findings"]:
        story.append(Paragraph("Findings", h2))
        table_data = [["Severity", "Category", "Issue", "Line"]]
        for f in review["findings"]:
            table_data.append([f["severity"].upper(), f["category"], f["issue"][:80], str(f.get("line_number") or "-")])
        t = Table(table_data, colWidths=[0.8 * inch, 0.9 * inch, 4 * inch, 0.5 * inch])
        t.setStyle(TableStyle([
            ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#1e293b")),
            ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
            ("FONTSIZE", (0, 0), (-1, -1), 8),
            ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, colors.HexColor("#f1f5f9")]),
            ("GRID", (0, 0), (-1, -1), 0.25, colors.HexColor("#e2e8f0")),
            ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ]))
        story.append(t)
    doc.build(story)
    buf.seek(0)
    return StreamingResponse(buf, media_type="application/pdf",
                             headers={"Content-Disposition": f"attachment; filename=review_{review_id}.pdf"})


@router.get("/{review_id}/pdf/executive")
def export_executive_pdf(review_id: int, current_user: dict = Depends(get_current_user)):
    """Executive summary PDF - brief overview."""
    review = _get_review_or_403(review_id, current_user["id"])
    ai = review.get("ai_review") or {}
    buf = BytesIO()
    doc = SimpleDocTemplate(buf, pagesize=A4, rightMargin=inch*0.75, leftMargin=inch*0.75,
                            topMargin=inch, bottomMargin=inch)
    styles = getSampleStyleSheet()
    title_style = ParagraphStyle("title", parent=styles["Title"], textColor=colors.HexColor("#1e293b"), fontSize=20)
    h2 = ParagraphStyle("h2", parent=styles["Heading2"], textColor=colors.HexColor("#334155"))
    body = styles["BodyText"]
    story = []
    story.append(Paragraph("Executive Summary", title_style))
    story.append(Paragraph(f"Project: {review['project_name']}", styles["Heading3"]))
    story.append(Spacer(1, 0.2*inch))
    score = review['review_score']
    score_color = colors.HexColor("#22C55E") if score >= 75 else colors.HexColor("#F59E0B") if score >= 50 else colors.HexColor("#EF4444")
    story.append(Paragraph(f"<font color='#{('22C55E' if score >= 75 else 'F59E0B' if score >= 50 else 'EF4444')}'>Overall Score: {score}/100</font>", styles["Heading2"]))
    story.append(Spacer(1, 0.1*inch))
    story.append(Paragraph("Summary", h2))
    story.append(Paragraph(review.get("summary") or "N/A", body))
    story.append(Spacer(1, 0.15*inch))
    if ai.get("improvements_summary"):
        story.append(Paragraph("Top Improvements", h2))
        story.append(Paragraph(ai["improvements_summary"], body))
    if ai.get("time_complexity") or ai.get("space_complexity"):
        story.append(Spacer(1, 0.15*inch))
        story.append(Paragraph("Complexity", h2))
        if ai.get("time_complexity"):
            story.append(Paragraph(f"Time Complexity: {ai['time_complexity']}", body))
        if ai.get("space_complexity"):
            story.append(Paragraph(f"Space Complexity: {ai['space_complexity']}", body))
    doc.build(story)
    buf.seek(0)
    return StreamingResponse(buf, media_type="application/pdf",
                             headers={"Content-Disposition": f"attachment; filename=executive_summary_{review_id}.pdf"})


@router.get("/{review_id}/pdf/security")
def export_security_pdf(review_id: int, current_user: dict = Depends(get_current_user)):
    """Security-focused PDF report."""
    review = _get_review_or_403(review_id, current_user["id"])
    ai = review.get("ai_review") or {}
    static = review.get("static_analysis") or {}
    buf = BytesIO()
    doc = SimpleDocTemplate(buf, pagesize=A4, rightMargin=inch*0.75, leftMargin=inch*0.75,
                            topMargin=inch, bottomMargin=inch)
    styles = getSampleStyleSheet()
    title_style = ParagraphStyle("title", parent=styles["Title"], textColor=colors.HexColor("#1e293b"), fontSize=20)
    h2 = ParagraphStyle("h2", parent=styles["Heading2"], textColor=colors.HexColor("#DC2626"))
    body = styles["BodyText"]
    story = []
    story.append(Paragraph("Security Analysis Report", title_style))
    story.append(Paragraph(f"Project: {review['project_name']}", styles["Heading3"]))
    story.append(Spacer(1, 0.2*inch))
    security_issues = ai.get("security_issues", [])
    bandit_findings = (static.get("bandit") or {}).get("findings", [])
    if security_issues:
        story.append(Paragraph("AI Security Issues", h2))
        for sec in security_issues:
            sev = sec.get("severity", "medium").upper()
            story.append(Paragraph(f"[{sev}] {sec.get('issue', '')}", body))
            if sec.get("suggestion"):
                story.append(Paragraph(f"  Fix: {sec['suggestion']}", styles["BodyText"]))
            story.append(Spacer(1, 0.05*inch))
    if bandit_findings:
        story.append(Spacer(1, 0.15*inch))
        story.append(Paragraph("Static Security Analysis (Bandit)", h2))
        for f in bandit_findings:
            story.append(Paragraph(f"[{f.get('severity','').upper()}] {f.get('issue', '')}", body))
            if f.get("line"):
                story.append(Paragraph(f"  Line: {f['line']}", styles["BodyText"]))
    if not security_issues and not bandit_findings:
        story.append(Paragraph("No security issues detected.", body))
    doc.build(story)
    buf.seek(0)
    return StreamingResponse(buf, media_type="application/pdf",
                             headers={"Content-Disposition": f"attachment; filename=security_report_{review_id}.pdf"})


@router.get("/{review_id}/pdf/complexity")
def export_complexity_pdf(review_id: int, current_user: dict = Depends(get_current_user)):
    """Complexity analysis PDF report."""
    review = _get_review_or_403(review_id, current_user["id"])
    ai = review.get("ai_review") or {}
    cx = review.get("complexity_metrics") or {}
    buf = BytesIO()
    doc = SimpleDocTemplate(buf, pagesize=A4, rightMargin=inch*0.75, leftMargin=inch*0.75,
                            topMargin=inch, bottomMargin=inch)
    styles = getSampleStyleSheet()
    title_style = ParagraphStyle("title", parent=styles["Title"], textColor=colors.HexColor("#1e293b"), fontSize=20)
    h2 = ParagraphStyle("h2", parent=styles["Heading2"], textColor=colors.HexColor("#334155"))
    body = styles["BodyText"]
    story = []
    story.append(Paragraph("Complexity Analysis Report", title_style))
    story.append(Paragraph(f"Project: {review['project_name']}", styles["Heading3"]))
    story.append(Spacer(1, 0.2*inch))
    if ai.get("time_complexity") or ai.get("space_complexity"):
        story.append(Paragraph("AI Complexity Analysis", h2))
        if ai.get("time_complexity"):
            story.append(Paragraph(f"Time Complexity: {ai['time_complexity']}", body))
        if ai.get("space_complexity"):
            story.append(Paragraph(f"Space Complexity: {ai['space_complexity']}", body))
        if ai.get("complexity_explanation"):
            story.append(Spacer(1, 0.1*inch))
            story.append(Paragraph(ai["complexity_explanation"], body))
        story.append(Spacer(1, 0.15*inch))
    metrics = [
        ["Metric", "Value"],
        ["Cyclomatic Complexity", str(cx.get("cyclomatic_complexity", "N/A"))],
        ["Maintainability Index", str(round(cx["maintainability_index"], 1)) if cx.get("maintainability_index") else "N/A"],
        ["Lines of Code", str(cx.get("loc", "N/A"))],
        ["Source Lines", str(cx.get("sloc", "N/A"))],
        ["Classes", str(cx.get("num_classes", "N/A"))],
        ["Functions", str(cx.get("num_functions", "N/A"))],
    ]
    story.append(Paragraph("Metrics", h2))
    t = Table(metrics, colWidths=[3*inch, 3*inch])
    t.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#1e293b")),
        ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
        ("FONTSIZE", (0, 0), (-1, -1), 9),
        ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, colors.HexColor("#f1f5f9")]),
        ("GRID", (0, 0), (-1, -1), 0.25, colors.HexColor("#e2e8f0")),
    ]))
    story.append(t)
    if cx.get("functions"):
        story.append(Spacer(1, 0.15*inch))
        story.append(Paragraph("Function Complexity", h2))
        fn_data = [["Function", "Complexity", "Rank"]]
        for fn in cx["functions"]:
            fn_data.append([fn.get("name", ""), str(fn.get("complexity", "")), fn.get("rank", "")])
        ft = Table(fn_data, colWidths=[4*inch, 1.5*inch, 0.8*inch])
        ft.setStyle(TableStyle([
            ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#1e293b")),
            ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
            ("FONTSIZE", (0, 0), (-1, -1), 9),
            ("GRID", (0, 0), (-1, -1), 0.25, colors.HexColor("#e2e8f0")),
        ]))
        story.append(ft)
    doc.build(story)
    buf.seek(0)
    return StreamingResponse(buf, media_type="application/pdf",
                             headers={"Content-Disposition": f"attachment; filename=complexity_report_{review_id}.pdf"})


@router.get("/{review_id}/markdown", response_class=PlainTextResponse)
def export_markdown(review_id: int, current_user: dict = Depends(get_current_user)):
    review = _get_review_or_403(review_id, current_user["id"])
    ai = review.get("ai_review") or {}
    lines = [
        f"# Code-Grammerizer Report — {review['project_name']}",
        f"**Score:** {review['review_score']}/100  ",
        f"**Date:** {review.get('created_at')}",
        "", "## Summary", review.get("summary") or "", "",
    ]
    for title, key in [("Bugs", "bugs"), ("Security Issues", "security_issues"),
                       ("Code Smells", "code_smells"), ("Performance", "performance"),
                       ("Best Practices", "best_practices"), ("Refactoring", "refactoring")]:
        items = ai.get(key, [])
        if items:
            lines.append(f"## {title}")
            for item in items:
                issue = item.get("issue") or item.get("description", "")
                suggestion = item.get("suggestion") or item.get("benefit", "")
                ln = f" (line {item['line']})" if item.get("line") else ""
                lines.append(f"- **{issue}**{ln}")
                if suggestion:
                    lines.append(f"  - *Suggestion:* {suggestion}")
            lines.append("")
    return "\n".join(lines)


@router.get("/{review_id}/html", response_class=PlainTextResponse)
def export_html(review_id: int, current_user: dict = Depends(get_current_user)):
    review = _get_review_or_403(review_id, current_user["id"])
    ai = review.get("ai_review") or {}
    cx = review.get("complexity_metrics") or {}
    score = review.get("review_score") or 0
    score_color = "#22C55E" if score >= 75 else "#F59E0B" if score >= 50 else "#EF4444"

    def sev_color(sev):
        return {"high": "#EF4444", "medium": "#F59E0B", "low": "#3B82F6"}.get(sev, "#6B7280")

    findings_html = ""
    for f in review.get("findings", []):
        color = sev_color(f.get("severity", "low"))
        findings_html += f"""<div style="border-left:3px solid {color};padding:8px 12px;margin:6px 0;background:#f9fafb;">
            <span style="color:{color};font-weight:600;font-size:11px;text-transform:uppercase;">{f.get('severity','')}</span>
            <span style="color:#6B7280;font-size:11px;margin-left:8px;">{f.get('category','')}</span>
            <p style="margin:4px 0;font-size:13px;">{f.get('issue','')}</p>
            {"<p style='color:#6B7280;font-size:12px;margin:2px 0;'>→ " + f['suggestion'] + "</p>" if f.get('suggestion') else ""}
        </div>"""

    html = f"""<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Code Review — {review['project_name']}</title>
<style>
  body{{font-family:Inter,system-ui,sans-serif;max-width:900px;margin:40px auto;padding:0 24px;color:#111118;line-height:1.6}}
  h1{{font-size:24px;font-weight:700;margin-bottom:4px}}
  h2{{font-size:16px;font-weight:600;color:#334155;margin-top:24px;border-bottom:1px solid #e2e8f0;padding-bottom:6px}}
  .score{{font-size:48px;font-weight:800;color:{score_color}}}
  .meta{{color:#9898a3;font-size:13px;margin-bottom:24px}}
  .card{{border:1px solid #e2e8f0;padding:16px;margin:8px 0;background:#fff}}
  .grid{{display:grid;grid-template-columns:repeat(3,1fr);gap:12px;margin:16px 0}}
  .stat{{border:1px solid #e2e8f0;padding:12px;text-align:center}}
  .stat-val{{font-size:24px;font-weight:700}}
  .stat-label{{font-size:11px;color:#9898a3;text-transform:uppercase;letter-spacing:.05em}}
  code{{background:#f1f5f9;padding:2px 5px;font-family:monospace;font-size:12px}}
</style>
</head>
<body>
<h1>Code-Grammerizer Report</h1>
<div class="meta">Project: <strong>{review['project_name']}</strong> &nbsp;|&nbsp; {review.get('created_at','')[:10]}</div>
<div class="score">{score}<span style="font-size:20px;color:#9898a3">/100</span></div>
<p style="color:#52525e;margin:12px 0 24px">{review.get('summary','')}</p>

<div class="grid">
  <div class="stat"><div class="stat-val" style="color:{score_color}">{score}</div><div class="stat-label">Quality Score</div></div>
  <div class="stat"><div class="stat-val">{cx.get('cyclomatic_complexity','—')}</div><div class="stat-label">Cyclomatic Complexity</div></div>
  <div class="stat"><div class="stat-val">{cx.get('maintainability_index','—') if not cx.get('maintainability_index') else round(cx['maintainability_index'],1)}</div><div class="stat-label">Maintainability Index</div></div>
  <div class="stat"><div class="stat-val">{cx.get('loc','—')}</div><div class="stat-label">Lines of Code</div></div>
  <div class="stat"><div class="stat-val">{cx.get('num_functions','—')}</div><div class="stat-label">Functions</div></div>
  <div class="stat"><div class="stat-val">{cx.get('avg_function_length','—')}</div><div class="stat-label">Avg Fn Length</div></div>
</div>

{"<h2>AI Complexity Analysis</h2><p>Time: <code>" + str(ai.get('time_complexity','')) + "</code> &nbsp; Space: <code>" + str(ai.get('space_complexity','')) + "</code></p><p style='color:#52525e'>" + str(ai.get('complexity_explanation','')) + "</p>" if ai.get('time_complexity') else ""}

{"<h2>Findings (" + str(len(review.get('findings',[]))) + ")</h2>" + findings_html if review.get('findings') else ""}

{"<h2>Top Improvements</h2><div class='card'>" + str(ai.get('improvements_summary','')) + "</div>" if ai.get('improvements_summary') else ""}
</body></html>"""
    from fastapi.responses import HTMLResponse
    return HTMLResponse(content=html, headers={"Content-Disposition": f"attachment; filename=review_{review_id}.html"})
