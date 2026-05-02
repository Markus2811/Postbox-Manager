/**
 * Erzeugt synthetische Test-PDFs (nur Fantasiedaten) lokal im Download-Ordner dieses PCs.
 * Dateien 17–26: Versicherungs-/Vertragsmotive mit eingebetteten PNG-Platzhalterbildern (keine echten Fotos).
 *
 *   Windows:  %USERPROFILE%\\Downloads\\postbox-test-documents
 *   Sonst:    ~/Downloads/postbox-test-documents
 *
 * Optional: Umgebungsvariable POSTBOX_TEST_PDF_OUT=absoluter\Pfad setzen.
 *
 * Ausführen im Projektordner postbox-manager: npm run generate-test-pdfs
 */

import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import * as fs from "fs";
import * as os from "os";
import * as path from "path";

function resolveOutputDir(): string {
  const custom = process.env.POSTBOX_TEST_PDF_OUT?.trim();
  if (custom) {
    return path.resolve(custom);
  }
  if (process.platform === "win32") {
    const profile = process.env.USERPROFILE;
    if (profile) {
      return path.join(profile, "Downloads", "postbox-test-documents");
    }
  }
  return path.join(os.homedir(), "Downloads", "postbox-test-documents");
}

type ManifestEntry = {
  filename: string;
  expected_document_type: string;
  expected_sender: string;
  expected_amount: number | null;
  expected_due_date: string | null;
  expected_action_required: boolean;
};

const PAGE_W = 595;
const PAGE_H = 842;
const MARGIN = 48;
const LINE = 13;
const SIZE = 10;

/** 1×1 PNG (gültig) – wird skaliert als Platzhalter für „Scan/Foto“. */
const MINI_PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQImWNgYGAHAAQDAHjVnBkAAAAASUVORK5CYII=",
  "base64"
);

async function buildPdf(lines: string[]): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  let page = pdf.addPage([PAGE_W, PAGE_H]);
  let y = PAGE_H - MARGIN;
  for (const raw of lines) {
    if (y < MARGIN + LINE) {
      page = pdf.addPage([PAGE_W, PAGE_H]);
      y = PAGE_H - MARGIN;
    }
    page.drawText(raw, {
      x: MARGIN,
      y,
      size: SIZE,
      font,
      color: rgb(0.12, 0.12, 0.14),
      maxWidth: PAGE_W - 2 * MARGIN,
    });
    y -= LINE;
  }
  return pdf.save();
}

/** PDF mit zwei eingebetteten Rasterbildern (Platzhalter) + Kopfzeilenfarbe + Fließtext. */
async function buildPdfWithImages(
  lines: string[],
  opts: { frameA: [number, number, number]; frameB: [number, number, number] }
): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const png = await pdf.embedPng(MINI_PNG);
  let page = pdf.addPage([PAGE_W, PAGE_H]);

  const imgH = 52;
  const imgW = 118;
  const imgY = PAGE_H - MARGIN - imgH;

  page.drawRectangle({
    x: MARGIN - 2,
    y: imgY - 2,
    width: imgW + 4,
    height: imgH + 4,
    color: rgb(...opts.frameA),
    borderColor: rgb(0.75, 0.76, 0.78),
    borderWidth: 0.5,
  });
  page.drawImage(png, { x: MARGIN, y: imgY, width: imgW, height: imgH });

  const x2 = MARGIN + imgW + 24;
  page.drawRectangle({
    x: x2 - 2,
    y: imgY - 2,
    width: imgW + 4,
    height: imgH + 4,
    color: rgb(...opts.frameB),
    borderColor: rgb(0.75, 0.76, 0.78),
    borderWidth: 0.5,
  });
  page.drawImage(png, { x: x2, y: imgY, width: imgW, height: imgH });

  page.drawText("Anhänge / eingescannte Auszüge (synthetische Platzhalterbilder, keine echten Fotos)", {
    x: MARGIN,
    y: imgY - 16,
    size: 7,
    font,
    color: rgb(0.45, 0.45, 0.48),
  });

  let y = imgY - 36;
  for (const raw of lines) {
    if (y < MARGIN + LINE) {
      page = pdf.addPage([PAGE_W, PAGE_H]);
      y = PAGE_H - MARGIN;
    }
    page.drawText(raw, {
      x: MARGIN,
      y,
      size: SIZE,
      font,
      color: rgb(0.12, 0.12, 0.14),
      maxWidth: PAGE_W - 2 * MARGIN,
    });
    y -= LINE;
  }
  return pdf.save();
}

type Spec = {
  filename: string;
  lines: string[];
  manifest: ManifestEntry;
  /** Zwei eingebettete PNG-Platzhalter oben auf der ersten Seite */
  withImages?: boolean;
  imageFrames?: { frameA: [number, number, number]; frameB: [number, number, number] };
};

const specs: Spec[] = [
  {
    filename: "01-stromrechnung-synthetisch.pdf",
    lines: [
      "Stadtwerke Nordlicht GmbH · Kundennummer 9988776655",
      "Rechnung Stromlieferung Mai 2026",
      "Absender: Stadtwerke Nordlicht GmbH, Musterweg 12, 10115 Berlin",
      "Empfänger: Max Mustermann, Gartenstraße 3, 80331 München",
      "Rechnungsdatum: 2026-05-10",
      "Fällig am: 2026-05-28",
      "Zu zahlender Betrag: 87,42 EUR",
      "Verbrauch 420 kWh · Arbeitspreis 0,28 EUR/kWh",
      "Bitte überweisen Sie den Betrag bis zum Fälligkeitsdatum auf IBAN DE00 0000 0000 0000 0000 00.",
      "Bei Zahlungsverzug können Mahngebühren anfallen.",
    ],
    manifest: {
      filename: "01-stromrechnung-synthetisch.pdf",
      expected_document_type: "invoice",
      expected_sender: "Stadtwerke Nordlicht GmbH",
      expected_amount: 87.42,
      expected_due_date: "2026-05-28",
      expected_action_required: true,
    },
  },
  {
    filename: "02-telekom-rechnung-synthetisch.pdf",
    lines: [
      "TeleNet AG · Kundennummer 5544332211",
      "Rechnung Mobilfunk & Internet · Abrechnungszeitraum April 2026",
      "Absender: TeleNet AG, Sendlinger Straße 88, 80331 München",
      "Empfänger: Erika Beispiel, Waldweg 7, 20095 Hamburg",
      "Rechnungsdatum: 2026-05-05",
      "Fällig am: 2026-05-19",
      "Gesamtbetrag: 49,99 EUR",
      "Tarif All-in-50 · monatliche Grundgebühr inklusive Datenpaket",
      "Bitte begleichen Sie den Rechnungsbetrag bis zum angegebenen Fälligkeitsdatum.",
    ],
    manifest: {
      filename: "02-telekom-rechnung-synthetisch.pdf",
      expected_document_type: "invoice",
      expected_sender: "TeleNet AG",
      expected_amount: 49.99,
      expected_due_date: "2026-05-19",
      expected_action_required: true,
    },
  },
  {
    filename: "03-nebenkosten-synthetisch.pdf",
    lines: [
      "Hausverwaltung Kiefer GmbH · Objekt Musterhof 4",
      "Betriebskostenabrechnung 2025",
      "Absender: Hausverwaltung Kiefer GmbH, Kiefernallee 2, 50667 Köln",
      "Empfänger: Familie Muster, Musterhof 4, 50667 Köln",
      "Abrechnungsdatum: 2026-04-20",
      "Nachzahlung fällig bis: 2026-06-15",
      "Nachzahlungsbetrag: 312,80 EUR",
      "Positionen: Heizung, Wasser, Hausmeister, Versicherung Gebäude",
      "Bitte überweisen Sie den Nachzahlungsbetrag bis zum genannten Datum.",
    ],
    manifest: {
      filename: "03-nebenkosten-synthetisch.pdf",
      expected_document_type: "invoice",
      expected_sender: "Hausverwaltung Kiefer GmbH",
      expected_amount: 312.8,
      expected_due_date: "2026-06-15",
      expected_action_required: true,
    },
  },
  {
    filename: "04-versicherungsschreiben-synthetisch.pdf",
    lines: [
      "SichereWelt Versicherung AG · Schadennummer 77-8899-01",
      "Information zu Ihrer Hausratversicherung",
      "Absender: SichereWelt Versicherung AG, Ringstraße 55, 60311 Frankfurt am Main",
      "Empfänger: Max Mustermann, Gartenstraße 3, 80331 München",
      "Datum Schreiben: 2026-05-01",
      "Es ist keine Zahlung erforderlich. Es handelt sich um eine rein informationelle Mitteilung.",
      "Ihre Vertragsnummer HR-2024-009988 läuft zum 31.12.2026 aus.",
      "Hinweis: Kündigungsfrist 3 Monate zum Laufzeitende.",
    ],
    manifest: {
      filename: "04-versicherungsschreiben-synthetisch.pdf",
      expected_document_type: "insurance",
      expected_sender: "SichereWelt Versicherung AG",
      expected_amount: null,
      expected_due_date: null,
      expected_action_required: false,
    },
  },
  {
    filename: "05-kfz-versicherung-synthetisch.pdf",
    lines: [
      "AutoSicher Kfz-Versicherung · Police KFZ-2026-4412",
      "Jahresprämie Kfz-Haftpflicht und Teilkasko",
      "Absender: AutoSicher GmbH, Autobahnring 9, 70499 Stuttgart",
      "Empfänger: Erika Beispiel, Kennzeichen M-AB 1234",
      "Stichtag: 2026-05-12",
      "Fällig am: 2026-05-30",
      "Jahresprämie: 428,00 EUR",
      "Bitte begleichen Sie die Prämie bis zum Fälligkeitsdatum, damit der Versicherungsschutz fortbesteht.",
    ],
    manifest: {
      filename: "05-kfz-versicherung-synthetisch.pdf",
      expected_document_type: "insurance",
      expected_sender: "AutoSicher GmbH",
      expected_amount: 428,
      expected_due_date: "2026-05-30",
      expected_action_required: true,
    },
  },
  {
    filename: "06-arztrechnung-synthetisch.pdf",
    lines: [
      "Gemeinschaftspraxis Musterallee · Rechnung Nr. 2026-1188",
      "Leistungsdatum: 2026-04-18",
      "Absender: Gemeinschaftspraxis Musterallee, Musterallee 40, 10437 Berlin",
      "Empfänger: Max Mustermann",
      "Rechnungsdatum: 2026-04-25",
      "Fällig am: 2026-05-09",
      "Rechnungsbetrag: 45,00 EUR (Privatleistung)",
      "Bitte überweisen Sie den Betrag unter Angabe der Rechnungsnummer.",
    ],
    manifest: {
      filename: "06-arztrechnung-synthetisch.pdf",
      expected_document_type: "medical",
      expected_sender: "Gemeinschaftspraxis Musterallee",
      expected_amount: 45,
      expected_due_date: "2026-05-09",
      expected_action_required: true,
    },
  },
  {
    filename: "07-steuerbescheid-synthetisch.pdf",
    lines: [
      "Finanzamt Musterstadt · Einkommensteuer 2024",
      "Steuerbescheid vom 2026-04-28",
      "Absender: Finanzamt Musterstadt, Steuerweg 1, 12345 Musterstadt",
      "Empfänger: Max Mustermann, Steuer-ID 12 345 678 901",
      "Festgesetzte Einkommensteuer: 1.842,00 EUR",
      "Nachzahlung: 120,00 EUR · fällig am 2026-06-12",
      "Bitte leisten Sie die Nachzahlung bis zum angegebenen Datum.",
    ],
    manifest: {
      filename: "07-steuerbescheid-synthetisch.pdf",
      expected_document_type: "tax",
      expected_sender: "Finanzamt Musterstadt",
      expected_amount: 120,
      expected_due_date: "2026-06-12",
      expected_action_required: true,
    },
  },
  {
    filename: "08-rundfunkbeitrag-synthetisch.pdf",
    lines: [
      "ARD ZDF Deutschlandradio Beitragsservice",
      "Bescheid Beitragskonto · Quartal 2/2026",
      "Absender: Beitragsservice von ARD, ZDF und Deutschlandradio, 50354 Hürth",
      "Empfänger: Erika Beispiel, Beitragsnummer 123456789",
      "Fällig am: 2026-05-15",
      "Beitrag: 55,08 EUR",
      "Bitte überweisen Sie den Betrag bis zum Fälligkeitsdatum.",
    ],
    manifest: {
      filename: "08-rundfunkbeitrag-synthetisch.pdf",
      expected_document_type: "government",
      expected_sender: "ARD ZDF Deutschlandradio Beitragsservice",
      expected_amount: 55.08,
      expected_due_date: "2026-05-15",
      expected_action_required: true,
    },
  },
  {
    filename: "09-handwerkerangebot-synthetisch.pdf",
    lines: [
      "Sanitär & Heizung Blau GmbH · Angebot AN-2026-044",
      "Angebot Badrenovierung",
      "Absender: Sanitär & Heizung Blau GmbH, Industriering 3, 90411 Nürnberg",
      "Empfänger: Familie Muster, Gartenstraße 3, 80331 München",
      "Angebotsdatum: 2026-05-03",
      "Angebotssumme netto: 4.900,00 EUR · brutto 5.831,00 EUR",
      "Angebot gültig bis 2026-05-31. Bitte erteilen Sie uns bis dahin eine schriftliche Auftragsbestätigung.",
    ],
    manifest: {
      filename: "09-handwerkerangebot-synthetisch.pdf",
      expected_document_type: "invoice",
      expected_sender: "Sanitär & Heizung Blau GmbH",
      expected_amount: 5831,
      expected_due_date: "2026-05-31",
      expected_action_required: true,
    },
  },
  {
    filename: "10-onlineshop-rechnung-synthetisch.pdf",
    lines: [
      "MegaShop Online GmbH · Bestellung 998-2211-44",
      "Rechnung",
      "Absender: MegaShop Online GmbH, Lagerstraße 100, 28195 Bremen",
      "Empfänger: Max Mustermann",
      "Rechnungsdatum: 2026-05-08",
      "Gesamtbetrag: 129,95 EUR inkl. MwSt.",
      "Zahlungsziel: 14 Tage ohne Abzug. Fällig am 2026-05-22.",
      "Bitte überweisen Sie den Betrag auf das angegebene Konto.",
    ],
    manifest: {
      filename: "10-onlineshop-rechnung-synthetisch.pdf",
      expected_document_type: "invoice",
      expected_sender: "MegaShop Online GmbH",
      expected_amount: 129.95,
      expected_due_date: "2026-05-22",
      expected_action_required: true,
    },
  },
  {
    filename: "11-vertragsbestaetigung-abo-synthetisch.pdf",
    lines: [
      "StreamNow GmbH · Vertragsbestätigung Premium-Abo",
      "Absender: StreamNow GmbH, Medienplatz 5, 50667 Köln",
      "Empfänger: Erika Beispiel",
      "Vertragsbeginn: 2026-05-01 · monatliche Kosten 12,99 EUR",
      "Die Mindestvertragslaufzeit beträgt 12 Monate. Kündigung zum Laufzeitende mit Frist von einem Monat.",
      "Es ist keine sofortige Zahlung erforderlich – Abbuchung erfolgt per SEPA-Lastschrift.",
    ],
    manifest: {
      filename: "11-vertragsbestaetigung-abo-synthetisch.pdf",
      expected_document_type: "contract",
      expected_sender: "StreamNow GmbH",
      expected_amount: 12.99,
      expected_due_date: null,
      expected_action_required: false,
    },
  },
  {
    filename: "12-mahnung-synthetisch.pdf",
    lines: [
      "Stadtwerke Nordlicht GmbH · Mahnung Stufe 1",
      "Offener Betrag aus Rechnung 9988776655 vom 2026-04-10",
      "Absender: Stadtwerke Nordlicht GmbH, Musterweg 12, 10115 Berlin",
      "Empfänger: Max Mustermann",
      "Mahndatum: 2026-05-18",
      "Offener Betrag: 92,10 EUR inkl. Mahngebühr 4,68 EUR",
      "Bitte begleichen Sie den Betrag bis spätestens 2026-05-25, um weitere Mahnstufen zu vermeiden.",
    ],
    manifest: {
      filename: "12-mahnung-synthetisch.pdf",
      expected_document_type: "invoice",
      expected_sender: "Stadtwerke Nordlicht GmbH",
      expected_amount: 92.1,
      expected_due_date: "2026-05-25",
      expected_action_required: true,
    },
  },
  {
    filename: "13-bankkonto-mitteilung-synth.pdf",
    lines: [
      "Nordbank AG · Servicecenter Privatkunden",
      "Mitteilung Kontoauszug April 2026",
      "Absender: Nordbank AG, Bankplatz 1, 20095 Hamburg",
      "Empfänger: Max Mustermann · IBAN DE12 3456 7890 1234 5678 90",
      "Auszugsdatum: 2026-05-01",
      "Neuer Kontostand: 1.284,33 EUR",
      "Fällige Gebühr Kontoführung: 9,90 EUR · fällig am 2026-05-20",
      "Bitte stellen Sie sicher, dass ausreichend Deckung für die Abbuchung vorliegt.",
    ],
    manifest: {
      filename: "13-bankkonto-mitteilung-synth.pdf",
      expected_document_type: "bank",
      expected_sender: "Nordbank AG",
      expected_amount: 9.9,
      expected_due_date: "2026-05-20",
      expected_action_required: true,
    },
  },
  {
    filename: "14-amt-brief-synth.pdf",
    lines: [
      "Landratsamt Beispielkreis · Sachbearbeitung Verkehr",
      "Bescheid Zulassungsgebühr",
      "Absender: Landratsamt Beispielkreis, Rathausplatz 2, 85049 Ingolstadt",
      "Empfänger: Erika Beispiel, Kennzeichen IN-XY 2026",
      "Bescheiddatum: 2026-05-06",
      "Zu zahlender Betrag: 54,00 EUR · fällig am 2026-06-01",
      "Bitte überweisen Sie den Betrag unter Angabe des Aktenzeichens VERK-2026-4412.",
    ],
    manifest: {
      filename: "14-amt-brief-synth.pdf",
      expected_document_type: "government",
      expected_sender: "Landratsamt Beispielkreis",
      expected_amount: 54,
      expected_due_date: "2026-06-01",
      expected_action_required: true,
    },
  },
  {
    filename: "15-krankenkasse-synth.pdf",
    lines: [
      "SolidKasse Krankenversicherung · Mitgliederservice",
      "Beitragsrechnung Juni 2026",
      "Absender: SolidKasse Krankenversicherung, Gesundheitsallee 9, 53113 Bonn",
      "Empfänger: Max Mustermann · Versichertennummer SK-778899",
      "Rechnungsdatum: 2026-05-12",
      "Monatsbeitrag: 198,50 EUR · fällig am 2026-05-28",
      "Bitte begleichen Sie den Betrag per SEPA-Lastschrift oder Überweisung bis zum Fälligkeitsdatum.",
    ],
    manifest: {
      filename: "15-krankenkasse-synth.pdf",
      expected_document_type: "insurance",
      expected_sender: "SolidKasse Krankenversicherung",
      expected_amount: 198.5,
      expected_due_date: "2026-05-28",
      expected_action_required: true,
    },
  },
  {
    filename: "16-steuer-vorauszahlung-synth.pdf",
    lines: [
      "Finanzamt Beispielstadt · Vorauszahlungen ESt",
      "Bescheid über zu leistende Vorauszahlungen 2026",
      "Absender: Finanzamt Beispielstadt, Finanzweg 5, 90402 Nürnberg",
      "Empfänger: Familie Muster, Steuer-ID 98 765 432 109",
      "Bescheiddatum: 2026-05-14",
      "Vorauszahlung Quartal 2: 450,00 EUR · fällig am 2026-06-10",
      "Bitte überweisen Sie den Betrag bis zum genannten Datum auf das angegebene Kassenkonto.",
    ],
    manifest: {
      filename: "16-steuer-vorauszahlung-synth.pdf",
      expected_document_type: "tax",
      expected_sender: "Finanzamt Beispielstadt",
      expected_amount: 450,
      expected_due_date: "2026-06-10",
      expected_action_required: true,
    },
  },
  {
    filename: "17-rechtsschutz-info-synth.pdf",
    withImages: true,
    imageFrames: { frameA: [0.93, 0.95, 0.99], frameB: [0.94, 0.92, 0.97] },
    lines: [
      "SicherRecht Versicherung AG · Rechtsschutz Privat",
      "Information zu Ihrer Police RS-2024-7712",
      "Absender: SicherRecht Versicherung AG, Justizweg 8, 10117 Berlin",
      "Empfänger: Max Mustermann, Versicherungsort München",
      "Datum: 2026-05-18",
      "Es handelt sich um eine rein informationelle Mitteilung zu Deckungsumfang und Erreichbarkeit des Partneranwalts.",
      "Im beiliegenden Scan sehen Sie symbolisch einen Auszug aus den allgemeinen Bedingungen (Muster, keine echten Daten).",
    ],
    manifest: {
      filename: "17-rechtsschutz-info-synth.pdf",
      expected_document_type: "insurance",
      expected_sender: "SicherRecht Versicherung AG",
      expected_amount: null,
      expected_due_date: null,
      expected_action_required: false,
    },
  },
  {
    filename: "18-hausrat-foto-dok-synth.pdf",
    withImages: true,
    imageFrames: { frameA: [0.98, 0.94, 0.9], frameB: [0.9, 0.96, 0.94] },
    lines: [
      "WohnSicher Hausratversicherung · Schadenbearbeitung",
      "Eingangsbestätigung Schadenmeldung H-2026-3301",
      "Absender: WohnSicher Versicherung AG, Domstraße 3, 50667 Köln",
      "Empfänger: Erika Beispiel, Police HS-8899",
      "Schadendatum (angenommen): 2026-05-12",
      "Die beigefügten Bilder sind synthetische Platzhalter und zeigen keine realen Räume oder Gegenstände.",
      "Bitte bewahren Sie beschädigte Gegenstände bis zur Regulierung auf (Merkblatt beilegend).",
    ],
    manifest: {
      filename: "18-hausrat-foto-dok-synth.pdf",
      expected_document_type: "insurance",
      expected_sender: "WohnSicher Versicherung AG",
      expected_amount: null,
      expected_due_date: null,
      expected_action_required: true,
    },
  },
  {
    filename: "19-lebensversicherung-auszug-synth.pdf",
    withImages: true,
    imageFrames: { frameA: [0.91, 0.94, 0.98], frameB: [0.96, 0.93, 0.91] },
    lines: [
      "VorsorgeTreu Lebensversicherung AG · Kundenportal",
      "Auszug Vertragskonto · Tarif KomfortRente",
      "Absender: VorsorgeTreu Lebensversicherung AG, Ringallee 22, 60325 Frankfurt am Main",
      "Empfänger: Familie Muster, Vertragsnummer LV-2008-441900",
      "Stand: 2026-05-20",
      "Rückkaufswert laut System: 14.220,00 EUR · keine fällige Zahlung in diesem Monat.",
      "Kündigungsfrist und Verlängerung: siehe Vertragsbedingungen im Anhang (Muster).",
    ],
    manifest: {
      filename: "19-lebensversicherung-auszug-synth.pdf",
      expected_document_type: "insurance",
      expected_sender: "VorsorgeTreu Lebensversicherung AG",
      expected_amount: 14220,
      expected_due_date: null,
      expected_action_required: false,
    },
  },
  {
    filename: "20-kfz-schaden-fotos-synth.pdf",
    withImages: true,
    imageFrames: { frameA: [0.88, 0.92, 0.98], frameB: [0.95, 0.9, 0.88] },
    lines: [
      "AutoSicher Kfz-Versicherung · Schadenservice",
      "Schadenmeldung KFZ-2026-8821 · Fahrzeug M-AB 2044",
      "Absender: AutoSicher GmbH, Autobahnring 9, 70499 Stuttgart",
      "Empfänger: Max Mustermann",
      "Unfalldatum (Muster): 2026-05-16 · Ort: Musterstadt (fiktiv)",
      "Die Bildplatzhalter dienen nur der Layout-Demonstration; es liegen keine echten Unfallfotos vor.",
      "Bitte füllen Sie den Vordruck vollständig aus und senden Sie ihn innerhalb von 7 Tagen zurück.",
    ],
    manifest: {
      filename: "20-kfz-schaden-fotos-synth.pdf",
      expected_document_type: "insurance",
      expected_sender: "AutoSicher GmbH",
      expected_amount: null,
      expected_due_date: null,
      expected_action_required: true,
    },
  },
  {
    filename: "21-reiseversicherung-police-synth.pdf",
    withImages: true,
    imageFrames: { frameA: [0.92, 0.97, 0.95], frameB: [0.94, 0.91, 0.97] },
    lines: [
      "WeltWeit Reiseversicherung GmbH · Police RV-2026-5510",
      "Absender: WeltWeit Reiseversicherung GmbH, Flughafenstraße 1, 40474 Düsseldorf",
      "Empfänger: Erika Beispiel",
      "Versicherungszeitraum: 2026-06-01 bis 2026-06-14 · Reiseziel: Beispielregion (fiktiv)",
      "Prämie: 38,90 EUR · fällig am 2026-05-25",
      "Die Abbildungen zeigen symbolisch Ausweis- und Buchungsdokumente (Muster, keine echten Daten).",
      "Bitte prüfen Sie die versicherten Leistungen im beiliegenden Leistungsüberblick.",
    ],
    manifest: {
      filename: "21-reiseversicherung-police-synth.pdf",
      expected_document_type: "insurance",
      expected_sender: "WeltWeit Reiseversicherung GmbH",
      expected_amount: 38.9,
      expected_due_date: "2026-05-25",
      expected_action_required: true,
    },
  },
  {
    filename: "22-mietvertrag-aenderung-synth.pdf",
    withImages: true,
    imageFrames: { frameA: [0.96, 0.94, 0.9], frameB: [0.9, 0.93, 0.96] },
    lines: [
      "Hausverwaltung Kiefer GmbH · Mietverwaltung",
      "Nachtrag zum Mietvertrag Objekt Musterhof 4 · Einheit 2B",
      "Absender: Hausverwaltung Kiefer GmbH, Kiefernallee 2, 50667 Köln",
      "Empfänger: Familie Muster, Musterhof 4, 50667 Köln",
      "Datum Nachtrag: 2026-05-19",
      "Geänderte Warmmiete ab 2026-07-01: 980,00 EUR (Musterwerte).",
      "Die eingescannten Seiten im Kopfbereich sind synthetische Platzhalter, keine echten Mietvertragsfotos.",
      "Bitte unterschriebenes Exemplar bis 2026-06-02 zurücksenden.",
    ],
    manifest: {
      filename: "22-mietvertrag-aenderung-synth.pdf",
      expected_document_type: "contract",
      expected_sender: "Hausverwaltung Kiefer GmbH",
      expected_amount: 980,
      expected_due_date: "2026-06-02",
      expected_action_required: true,
    },
  },
  {
    filename: "23-stromliefervertrag-synth.pdf",
    withImages: true,
    imageFrames: { frameA: [0.93, 0.96, 0.92], frameB: [0.89, 0.94, 0.98] },
    lines: [
      "Stadtwerke Nordlicht GmbH · Energieliefervertrag",
      "Vertragsänderung dynamischer Tarif „Nordlicht flex 2026“",
      "Absender: Stadtwerke Nordlicht GmbH, Musterweg 12, 10115 Berlin",
      "Empfänger: Max Mustermann, Zählpunkt 1-NT:998877",
      "Wirksamkeit: 2026-06-15 · Kündigungsfrist 6 Wochen zum Quartalsende.",
      "Die Bilder im Kopf symbolisieren Zähler und Vertragspassagen (Muster, nicht lesbar als Foto).",
      "Widerspruch möglich innerhalb von 14 Tagen nach Zugang dieses Schreibens.",
    ],
    manifest: {
      filename: "23-stromliefervertrag-synth.pdf",
      expected_document_type: "contract",
      expected_sender: "Stadtwerke Nordlicht GmbH",
      expected_amount: null,
      expected_due_date: null,
      expected_action_required: true,
    },
  },
  {
    filename: "24-mobilfunk-vertrag-synth.pdf",
    withImages: true,
    imageFrames: { frameA: [0.95, 0.91, 0.96], frameB: [0.91, 0.96, 0.93] },
    lines: [
      "TeleNet AG · Vertragsbestätigung Mobilfunk",
      "Gerätefinanzierung und Tarif „All-in-50“",
      "Absender: TeleNet AG, Sendlinger Straße 88, 80331 München",
      "Empfänger: Erika Beispiel, Kundennummer 5544332211",
      "Vertragsbeginn: 2026-06-01 · monatliche Rate Gerät 12,00 EUR + Tarif 49,99 EUR.",
      "Abbildungen zeigen symbolisch Vertragsunterlagen und Gerät (keine realen Seriennummern).",
      "Widerrufsrecht: siehe beiliegender Hinweis (Muster).",
    ],
    manifest: {
      filename: "24-mobilfunk-vertrag-synth.pdf",
      expected_document_type: "contract",
      expected_sender: "TeleNet AG",
      expected_amount: 61.99,
      expected_due_date: null,
      expected_action_required: false,
    },
  },
  {
    filename: "25-bausparvertrag-info-synth.pdf",
    withImages: true,
    imageFrames: { frameA: [0.9, 0.94, 0.97], frameB: [0.97, 0.92, 0.9] },
    lines: [
      "BauSparen Musterbank AG · Bausparabteilung",
      "Information zu Ihrem Bausparvertrag BS-441-009922",
      "Absender: BauSparen Musterbank AG, Sparkassenplatz 1, 30159 Hannover",
      "Empfänger: Familie Muster",
      "Sparstand laut System: 22.400,00 EUR · Vertragszins angepasst ab 2026-07-01 (Muster).",
      "Die Grafiken oben sind Platzhalter für Sparurkunde und Vertragstext (synthetisch).",
      "Es ist keine sofortige Unterschrift erforderlich – nur Kenntnisnahme.",
    ],
    manifest: {
      filename: "25-bausparvertrag-info-synth.pdf",
      expected_document_type: "contract",
      expected_sender: "BauSparen Musterbank AG",
      expected_amount: 22400,
      expected_due_date: null,
      expected_action_required: false,
    },
  },
  {
    filename: "26-unfallversicherung-antrag-synth.pdf",
    withImages: true,
    imageFrames: { frameA: [0.92, 0.9, 0.97], frameB: [0.96, 0.94, 0.92] },
    lines: [
      "SichereWelt Versicherung AG · Unfallversicherung",
      "Antrag UV-2026-1188 (Entwurf)",
      "Absender: SichereWelt Versicherung AG, Ringstraße 55, 60311 Frankfurt am Main",
      "Empfänger: Max Mustermann",
      "Beitragsvorschlag: 18,40 EUR monatlich · Beginn vorgeschlagen: 2026-07-01",
      "Die Fotoplatzhalter symbolisieren Ausweis- und Unterschriftsbereich (keine echten Personaldaten).",
      "Bitte prüfen Sie die Angaben und senden Sie den Antrag unterschrieben bis 2026-06-05 zurück.",
    ],
    manifest: {
      filename: "26-unfallversicherung-antrag-synth.pdf",
      expected_document_type: "insurance",
      expected_sender: "SichereWelt Versicherung AG",
      expected_amount: 18.4,
      expected_due_date: "2026-06-05",
      expected_action_required: true,
    },
  },
];

async function main() {
  const outDir = resolveOutputDir();
  fs.mkdirSync(outDir, { recursive: true });
  const manifest: ManifestEntry[] = [];

  const defaultFrames = { frameA: [0.93, 0.95, 0.98] as [number, number, number], frameB: [0.95, 0.92, 0.96] as [number, number, number] };

  for (const spec of specs) {
    const bytes = spec.withImages
      ? await buildPdfWithImages(spec.lines, spec.imageFrames ?? defaultFrames)
      : await buildPdf(spec.lines);
    fs.writeFileSync(path.join(outDir, spec.filename), bytes);
    manifest.push(spec.manifest);
  }

  fs.writeFileSync(
    path.join(outDir, "manifest.json"),
    JSON.stringify(manifest, null, 2),
    "utf8"
  );

  const abs = path.resolve(outDir);
  console.log(`OK: ${specs.length} PDFs + manifest.json`);
  console.log(`Ordner (absolut): ${abs}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
