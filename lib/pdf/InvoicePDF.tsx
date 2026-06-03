/**
 * Invoice PDF template — rendered server-side via @react-pdf/renderer.
 * Layout mirrors v1's Google Docs template: navy header strip + gold accent,
 * company info top-left + "INVOICE" + meta top-right, bill-to block,
 * line items table, totals block, bank details footer.
 *
 * Reads company data from the Settings record passed in by the caller.
 */

import React from "react";
import { Document, Page, Text, View, StyleSheet, Image } from "@react-pdf/renderer";
import type { InvoiceRow } from "@/lib/types";
import type { Settings } from "@/lib/queries/settings";

// ---- Palette (matches the app theme) ----
const NAVY        = "#0f2747";
const NAVY_LIGHT  = "#1c3a5e";
const GOLD        = "#c8a45c";
const MUTED       = "#6b7689";
const BORDER      = "#e6e9ef";
const DANGER      = "#c0392b";

const styles = StyleSheet.create({
  page:       { padding: 36, fontSize: 10, fontFamily: "Helvetica", color: "#1a2438" },
  topBar:     { backgroundColor: NAVY, height: 6, marginBottom: 18 },

  headerRow:  { flexDirection: "row", justifyContent: "space-between", marginBottom: 18 },
  brand:      { flexDirection: "row", alignItems: "flex-start" },
  logo:       { width: 44, height: 44, marginRight: 10 },
  companyBlock: { maxWidth: 260 },
  companyName:  { fontSize: 12, fontWeight: 700, color: NAVY, marginBottom: 2 },
  companyMeta:  { fontSize: 8, color: MUTED, lineHeight: 1.4 },

  docMeta:     { textAlign: "right" },
  docLabel:    { color: GOLD, fontSize: 9, letterSpacing: 1, marginBottom: 2 },
  docTitle:    { fontSize: 22, fontWeight: 700, color: NAVY, marginBottom: 8 },
  metaRow:     { flexDirection: "row", justifyContent: "flex-end", marginBottom: 1 },
  metaKey:     { color: MUTED, fontSize: 8, width: 60, textAlign: "right" },
  metaVal:     { fontSize: 9, marginLeft: 6, color: "#1a2438" },

  sectionLabel:{ fontSize: 8, color: GOLD, letterSpacing: 1, marginBottom: 3 },
  billTo:      { marginBottom: 18 },
  customerName:{ fontSize: 11, fontWeight: 700, marginBottom: 2 },
  customerLine:{ fontSize: 9, color: MUTED, lineHeight: 1.4 },

  table:       { marginBottom: 14 },
  trHead:      { flexDirection: "row", backgroundColor: NAVY, color: "#fff", paddingVertical: 5, paddingHorizontal: 6 },
  trBody:      { flexDirection: "row", borderBottom: `0.5pt solid ${BORDER}`, paddingVertical: 5, paddingHorizontal: 6 },
  thIdx:       { width: 18, fontSize: 8, color: "#fff" },
  thDesc:      { flex: 1,  fontSize: 8, color: "#fff" },
  thQty:       { width: 36, fontSize: 8, color: "#fff", textAlign: "right" },
  thUnit:      { width: 70, fontSize: 8, color: "#fff", textAlign: "right" },
  thAmt:       { width: 70, fontSize: 8, color: "#fff", textAlign: "right" },
  tdIdx:       { width: 18, fontSize: 9, color: MUTED },
  tdDesc:      { flex: 1,  fontSize: 9 },
  tdQty:       { width: 36, fontSize: 9, textAlign: "right" },
  tdUnit:      { width: 70, fontSize: 9, textAlign: "right" },
  tdAmt:       { width: 70, fontSize: 9, textAlign: "right", fontWeight: 700 },

  totalsBox:   { marginLeft: "auto", width: 220, marginBottom: 16 },
  totalsRow:   { flexDirection: "row", justifyContent: "space-between", paddingVertical: 3 },
  totalsKey:   { color: MUTED, fontSize: 9 },
  totalsVal:   { fontSize: 9 },
  totalsTotal: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 6, borderTop: `1pt solid ${NAVY}`, marginTop: 4 },
  totalsTotalKey: { color: NAVY, fontSize: 11, fontWeight: 700 },
  totalsTotalVal: { color: NAVY, fontSize: 12, fontWeight: 700 },

  noteBlock:   { padding: 8, backgroundColor: "#f4f6fa", borderRadius: 4, marginBottom: 14 },
  noteLabel:   { fontSize: 8, color: GOLD, marginBottom: 3, letterSpacing: 1 },
  noteText:    { fontSize: 9, color: "#1a2438", lineHeight: 1.4 },

  bankBox:     { borderTop: `2pt solid ${GOLD}`, paddingTop: 8 },
  bankTitle:   { fontSize: 9, fontWeight: 700, color: NAVY, marginBottom: 4 },
  bankRow:     { flexDirection: "row", marginBottom: 1 },
  bankKey:     { color: MUTED, fontSize: 8, width: 80 },
  bankVal:     { fontSize: 9 },

  footer:      { position: "absolute", bottom: 24, left: 36, right: 36, textAlign: "center", color: MUTED, fontSize: 7 },

  statusBadge: { padding: 4, marginLeft: 8, borderRadius: 3, fontSize: 8, fontWeight: 700 },
});

function money(v: number, currency: string): string {
  return `${currency} ${v.toFixed(2)}`;
}

export function InvoicePDF({ invoice, settings }: { invoice: InvoiceRow; settings: Settings }) {
  const currency = settings.currency || "MYR";
  const items = invoice.items || [];

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <View style={styles.topBar} />

        {/* Header */}
        <View style={styles.headerRow}>
          <View style={styles.brand}>
            {settings.logo_url ? <Image src={settings.logo_url} style={styles.logo} /> : null}
            <View style={styles.companyBlock}>
              <Text style={styles.companyName}>{settings.company_name}</Text>
              {settings.company_address ? <Text style={styles.companyMeta}>{settings.company_address}</Text> : null}
              {settings.company_tax_id  ? <Text style={styles.companyMeta}>Tax ID: {settings.company_tax_id}</Text> : null}
              {settings.company_phone   ? <Text style={styles.companyMeta}>Tel: {settings.company_phone}</Text> : null}
              {settings.company_email   ? <Text style={styles.companyMeta}>{settings.company_email}</Text> : null}
            </View>
          </View>

          <View style={styles.docMeta}>
            <Text style={styles.docLabel}>INVOICE</Text>
            <Text style={styles.docTitle}>{invoice.invoice_number}</Text>
            <View style={styles.metaRow}>
              <Text style={styles.metaKey}>Date</Text>
              <Text style={styles.metaVal}>{invoice.date}</Text>
            </View>
            <View style={styles.metaRow}>
              <Text style={styles.metaKey}>Due</Text>
              <Text style={styles.metaVal}>{invoice.due_date}</Text>
            </View>
            <View style={styles.metaRow}>
              <Text style={styles.metaKey}>Status</Text>
              <Text style={[styles.metaVal, { color: invoice.status === "paid" ? NAVY : invoice.status === "sent" ? GOLD : DANGER }]}>
                {invoice.status.toUpperCase()}
              </Text>
            </View>
          </View>
        </View>

        {/* Bill To */}
        <View style={styles.billTo}>
          <Text style={styles.sectionLabel}>BILL TO</Text>
          <Text style={styles.customerName}>{invoice.customer_name}</Text>
          {invoice.customer_email   ? <Text style={styles.customerLine}>{invoice.customer_email}</Text> : null}
          {invoice.customer_address ? <Text style={styles.customerLine}>{invoice.customer_address}</Text> : null}
          {invoice.site_address     ? <Text style={styles.customerLine}>Site: {invoice.site_address}</Text> : null}
        </View>

        {/* Line items table */}
        <View style={styles.table}>
          <View style={styles.trHead}>
            <Text style={styles.thIdx}>#</Text>
            <Text style={styles.thDesc}>Description</Text>
            <Text style={styles.thQty}>Qty</Text>
            <Text style={styles.thUnit}>Unit Price</Text>
            <Text style={styles.thAmt}>Amount</Text>
          </View>
          {items.map((it, i) => (
            <View key={i} style={styles.trBody}>
              <Text style={styles.tdIdx}>{i + 1}</Text>
              <View style={styles.tdDesc}>
                <Text>{it.desc}</Text>
                {it.discount_percent ? (
                  <Text style={{ fontSize: 7, color: DANGER, marginTop: 1, fontWeight: 700 }}>
                    {it.discount_percent}% OFF{"  "}
                    <Text style={{ textDecoration: "line-through", color: MUTED, fontWeight: 400 }}>
                      was {money(it.original_unit_price ?? 0, currency)}
                    </Text>
                  </Text>
                ) : null}
              </View>
              <Text style={styles.tdQty}>{it.qty}</Text>
              <Text style={styles.tdUnit}>{money(it.unit_price, currency)}</Text>
              <Text style={styles.tdAmt}>{money(it.amount, currency)}</Text>
            </View>
          ))}
        </View>

        {/* Totals */}
        <View style={styles.totalsBox}>
          <View style={styles.totalsRow}>
            <Text style={styles.totalsKey}>Subtotal</Text>
            <Text style={styles.totalsVal}>{money(invoice.subtotal, currency)}</Text>
          </View>
          {invoice.discount_percent > 0 ? (
            <View style={styles.totalsRow}>
              <Text style={[styles.totalsKey, { color: DANGER }]}>Discount ({invoice.discount_percent}%)</Text>
              <Text style={[styles.totalsVal, { color: DANGER }]}>−{money(invoice.subtotal * (invoice.discount_percent / 100), currency)}</Text>
            </View>
          ) : null}
          {invoice.tax > 0 ? (
            <View style={styles.totalsRow}>
              <Text style={styles.totalsKey}>Tax</Text>
              <Text style={styles.totalsVal}>{money(invoice.tax, currency)}</Text>
            </View>
          ) : null}
          <View style={styles.totalsTotal}>
            <Text style={styles.totalsTotalKey}>TOTAL</Text>
            <Text style={styles.totalsTotalVal}>{money(invoice.total, currency)}</Text>
          </View>
        </View>

        {/* Note */}
        {invoice.note ? (
          <View style={styles.noteBlock}>
            <Text style={styles.noteLabel}>NOTE</Text>
            <Text style={styles.noteText}>{invoice.note}</Text>
          </View>
        ) : null}

        {/* Bank info */}
        {settings.bank_name ? (
          <View style={styles.bankBox}>
            <Text style={styles.bankTitle}>Payment Details</Text>
            <View style={styles.bankRow}>
              <Text style={styles.bankKey}>Bank</Text>
              <Text style={styles.bankVal}>{settings.bank_name}</Text>
            </View>
            <View style={styles.bankRow}>
              <Text style={styles.bankKey}>Account Name</Text>
              <Text style={styles.bankVal}>{settings.bank_account_name}</Text>
            </View>
            <View style={styles.bankRow}>
              <Text style={styles.bankKey}>Account No.</Text>
              <Text style={styles.bankVal}>{settings.bank_account_no}</Text>
            </View>
          </View>
        ) : null}

        <Text style={styles.footer}>
          Generated by OLCC Books · Please reference {invoice.invoice_number} on payment
        </Text>
      </Page>
    </Document>
  );
}
