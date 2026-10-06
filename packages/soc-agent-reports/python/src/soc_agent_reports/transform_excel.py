"""Portable workbook renderer retaining the established case-review layout."""

from pathlib import Path

import xlsxwriter

from .report_model import HEADERS, ReportModel, SEVERITIES


def create_workbook(model: ReportModel, output_path: Path) -> None:
    workbook = xlsxwriter.Workbook(str(output_path), {"strings_to_formulas": False, "strings_to_urls": False})
    try:
        bold = workbook.add_format({"bold": True})
        date_format = workbook.add_format({"num_format": "m/d/yy h:mm"})
        text_format = workbook.add_format({"num_format": "@"})
        for severity in SEVERITIES:
            sheet = workbook.add_worksheet(severity.title())
            for column, width in enumerate((66, 10, 18, 25, 12, 54)):
                sheet.set_column(column, column, width)
            sheet.write_row(0, 0, ["Customer Remark / TP-FP Status" if name == "Reason" else name for name in HEADERS], bold)
            row = 1
            for case in model.cases:
                if case.severity != severity:
                    continue
                values = case.excel_row()
                for column, name in enumerate(HEADERS):
                    if name == "TicketTime":
                        sheet.write_datetime(row, column, case.ticket_time, date_format)
                    else:
                        sheet.write_string(row, column, values[name], text_format if name == "Ticketnumber" else None)
                row += 1
    finally:
        workbook.close()
    if not output_path.is_file() or output_path.stat().st_size == 0:
        raise RuntimeError("Workbook renderer did not create the requested Excel file.")
