/**
 * Receipt PDF template — confirms money received. Same visual language as
 * the Invoice (so customers immediately recognize they're related) but
 * the docLabel is "OFFICIAL RECEIPT" and the totals box is highlighted
 * green (paid). If linked to an invoice, the receipt cites it.
 */

import React from "react";
import { Document, Page, Text, View, StyleSheet, Image } from "@react-pdf/renderer";
import type { ReceiptRow } from "@/lib/types";
import type { Settings } from "@/lib/queries/settings";

const NAVY    = "#0f2747";
const GOLD    = "#c8a45c";
const SUCCESS = "#1f8a5b";
const DANGER  = "#c0392b";
const MUTED   = "#6b7689";
const BORDER  = "#e6e9ef";

const styles = StyleSheet.create({
  page:       { padding: 36, fontSize: 10, fontFamily: "Helvetica", color: "#1a2438" },
  topBar:     { backgroundColor: SUCCESS, height: 6, marginBottom: 18 },

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
  metaKey:     { color: MUTED, fontSize: 8, width: 80, textAlign: "right" },
  metaVal:     { fontSize: 9, marginLeft: 6 },

  paidStamp:   { padding: 6, backgroundColor: SUCCESS, color: "#fff", fontWeight: 700, fontSize: 10, marginTop: 4, textAlign: "center" },

  sectionLabel:{ fontSize: 8, color: GOLD, letterSpacing: 1, marginBottom: 3 },
  recvFrom:    { marginBottom: 18 },
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
  totalsTotal: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 6, borderTop: `1pt solid ${SUCCESS}`, marginTop: 4, backgroundColor: "#e7f7ef", paddingHorizontal: 6, borderRadius: 3 },
  totalsTotalKey: { color: SUCCESS, fontSize: 11, fontWeight: 700 },
  totalsTotalVal: { color: SUCCESS, fontSize: 12, fontWeight: 700 },

  payMethodBox:{ flexDirection: "row", padding: 8, backgroundColor: "#f4f6fa", borderRadius: 4, marginBottom: 14 },
  payMethodKey:{ fontSize: 9, color: MUTED, marginRight: 8 },
  payMethodVal:{ fontSize: 9, fontWeight: 700 },

  footer:      { position: "absolute", bottom: 24, left: 36, right: 36, textAlign: "center", color: MUTED, fontSize: 7 },
});

function money(v: number, currency: string) {
  return `${currency} ${v.toFixed(2)}`;
}

export function ReceiptPDF({ receipt, settings }: { receipt: ReceiptRow; settings: Settings }) {
  const currency = settings.currency || "MYR";
  const items = receipt.items || [];

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <View style={styles.topBar} />

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
            <Text style={styles.docLabel}>OFFICIAL RECEIPT</Text>
            <Text style={styles.docTitle}>{receipt.receipt_number}</Text>
            <View style={styles.metaRow}>
              <Text style={styles.metaKey}>Date</Text>
              <Text style={styles.metaVal}>{receipt.date}</Text>
            </View>
            <Text style={styles.paidStamp}>PAID</Text>
          </View>
        </View>

        <View style={styles.recvFrom}>
          <Text style={styles.sectionLabel}>RECEIVED FROM</Text>
          <Text style={styles.customerName}>{receipt.customer_name}</Text>
          {receipt.customer_email   ? <Text style={styles.customerLine}>{receipt.customer_email}</Text> : null}
          {receipt.customer_address ? <Text style={styles.customerLine}>{receipt.customer_address}</Text> : null}
        </View>

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

        <View style={styles.totalsBox}>
          <View style={styles.totalsRow}>
            <Text style={styles.totalsKey}>Subtotal</Text>
            <Text style={styles.totalsVal}>{money(receipt.subtotal, currency)}</Text>
          </View>
          {receipt.discount_percent > 0 ? (
            <View style={styles.totalsRow}>
              <Text style={[styles.totalsKey, { color: DANGER }]}>Discount ({receipt.discount_percent}%)</Text>
              <Text style={[styles.totalsVal, { color: DANGER }]}>−{money(receipt.subtotal * (receipt.discount_percent / 100), currency)}</Text>
            </View>
          ) : null}
          {receipt.tax > 0 ? (
            <View style={styles.totalsRow}>
              <Text style={styles.totalsKey}>Tax</Text>
              <Text style={styles.totalsVal}>{money(receipt.tax, currency)}</Text>
            </View>
          ) : null}
          <View style={styles.totalsTotal}>
            <Text style={styles.totalsTotalKey}>RECEIVED</Text>
            <Text style={styles.totalsTotalVal}>{money(receipt.total, currency)}</Text>
          </View>
        </View>

        <View style={styles.payMethodBox}>
          <Text style={styles.payMethodKey}>Payment Method:</Text>
          <Text style={styles.payMethodVal}>{receipt.payment_method}</Text>
        </View>

        <Text style={styles.footer}>
          Thank you for your payment · Generated by OLCC Books
        </Text>
      </Page>
    </Document>
  );
}
