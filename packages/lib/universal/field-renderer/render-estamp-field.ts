import JsBarcode from 'jsbarcode';
import Konva from 'konva';

import sharakatLogo from '@documenso/assets/static/sharakat-logo.png';

import {
  createFieldHoverInteraction,
  upsertFieldGroup,
  upsertFieldRect,
} from './field-generic-items';
import type { FieldToRender, RenderFieldElementOptions } from './field-renderer';

const STAMP_WIDTH = 210;
const HEADER_HEIGHT = 38;
const ROW_HEIGHT = 22;
const BARCODE_ROW_HEIGHT = 24;
const NUM_ROWS = 4; // رقم, التاريخ, وارد من, المرفقات
const STAMP_HEIGHT = HEADER_HEIGHT + ROW_HEIGHT * NUM_ROWS + BARCODE_ROW_HEIGHT;

const BORDER_COLOR = '#1B3A6B';
const TEXT_COLOR = '#1B3A6B';
const FONT_FAMILY = 'Arial, sans-serif';

const LABEL_COL_WIDTH = 80;
const VALUE_COL_WIDTH = STAMP_WIDTH - LABEL_COL_WIDTH;
const INNER_PADDING = 4;

const addRow = (
  group: Konva.Group,
  label: string,
  value: string,
  yOffset: number,
  lang: 'arabic' | 'english' = 'arabic',
  fontSize = 8,
) => {
  const isArabic = lang === 'arabic';
  const dividerX = isArabic ? VALUE_COL_WIDTH : LABEL_COL_WIDTH;

  // Vertical divider
  group.add(
    new Konva.Line({
      points: [dividerX, yOffset, dividerX, yOffset + ROW_HEIGHT],
      stroke: BORDER_COLOR,
      strokeWidth: 0.5,
    }),
  );

  // Bottom border of row
  group.add(
    new Konva.Line({
      points: [0, yOffset + ROW_HEIGHT, STAMP_WIDTH, yOffset + ROW_HEIGHT],
      stroke: BORDER_COLOR,
      strokeWidth: 0.5,
    }),
  );

  if (isArabic) {
    // Label — right column, right-aligned (RTL)
    group.add(
      new Konva.Text({
        text: label,
        x: VALUE_COL_WIDTH,
        y: yOffset,
        width: LABEL_COL_WIDTH - INNER_PADDING,
        height: ROW_HEIGHT,
        fontSize,
        fontFamily: FONT_FAMILY,
        fill: TEXT_COLOR,
        align: 'right',
        verticalAlign: 'middle',
      }),
    );

    // Value — left column
    group.add(
      new Konva.Text({
        text: value,
        x: INNER_PADDING,
        y: yOffset,
        width: VALUE_COL_WIDTH - INNER_PADDING * 2,
        height: ROW_HEIGHT,
        fontSize,
        fontFamily: FONT_FAMILY,
        fill: TEXT_COLOR,
        align: 'left',
        verticalAlign: 'middle',
      }),
    );
  } else {
    // Label — left column, left-aligned (LTR)
    group.add(
      new Konva.Text({
        text: label,
        x: INNER_PADDING,
        y: yOffset,
        width: LABEL_COL_WIDTH - INNER_PADDING,
        height: ROW_HEIGHT,
        fontSize,
        fontFamily: FONT_FAMILY,
        fill: TEXT_COLOR,
        align: 'left',
        verticalAlign: 'middle',
      }),
    );

    // Value — right column
    group.add(
      new Konva.Text({
        text: value,
        x: LABEL_COL_WIDTH + INNER_PADDING,
        y: yOffset,
        width: VALUE_COL_WIDTH - INNER_PADDING * 2,
        height: ROW_HEIGHT,
        fontSize,
        fontFamily: FONT_FAMILY,
        fill: TEXT_COLOR,
        align: 'left',
        verticalAlign: 'middle',
      }),
    );
  }
};

const createFieldEstamp = (field: FieldToRender): Konva.Group => {
  const fieldMeta = field.fieldMeta?.type === 'estamp' ? field.fieldMeta : undefined;
  const lang = fieldMeta?.lang ?? 'arabic';
  const estampGroup = new Konva.Group();

  // Outer border
  estampGroup.add(
    new Konva.Rect({
      x: 0,
      y: 0,
      width: STAMP_WIDTH,
      height: STAMP_HEIGHT,
      stroke: BORDER_COLOR,
      strokeWidth: 2,
      cornerRadius: 4,
      fill: 'white',
    }),
  );

  // ── HEADER ────────────────────────────────────────────────────────────────

  // Logo (left side of header)
  const logoImg = new window.Image();
  logoImg.src = sharakatLogo;

  const logoKonva = new Konva.Image({
    image: logoImg,
    x: INNER_PADDING,
    y: 3,
    width: 50,
    height: HEADER_HEIGHT - 6,
  });

  logoImg.onload = () => {
    const aspect = logoImg.naturalWidth / logoImg.naturalHeight;
    const maxH = HEADER_HEIGHT - 6;
    const maxW = 60;
    let w = maxH * aspect;
    if (w > maxW) {
      w = maxW;
    }
    const h = w / aspect;
    logoKonva.width(w);
    logoKonva.height(h);
    logoKonva.y((HEADER_HEIGHT - h) / 2);
    estampGroup.getLayer()?.batchDraw();
  };

  estampGroup.add(logoKonva);

  // Company name Arabic (right of header, top)
  estampGroup.add(
    new Konva.Text({
      text: 'الشركة السعودية لشراكات المياه',
      x: STAMP_WIDTH / 2,
      y: 5,
      width: STAMP_WIDTH / 2 - INNER_PADDING,
      height: 16,
      fontSize: 7,
      fontFamily: FONT_FAMILY,
      fill: TEXT_COLOR,
      align: 'right',
      verticalAlign: 'middle',
    }),
  );

  // Company name English (right of header, bottom)
  estampGroup.add(
    new Konva.Text({
      text: 'Saudi Water Partnership Company',
      x: STAMP_WIDTH / 2,
      y: 22,
      width: STAMP_WIDTH / 2 - INNER_PADDING,
      height: 14,
      fontSize: 6,
      fontFamily: FONT_FAMILY,
      fill: TEXT_COLOR,
      align: 'right',
      verticalAlign: 'middle',
    }),
  );

  // Header bottom divider
  estampGroup.add(
    new Konva.Line({
      points: [0, HEADER_HEIGHT, STAMP_WIDTH, HEADER_HEIGHT],
      stroke: BORDER_COLOR,
      strokeWidth: 1,
    }),
  );

  // ── DATA ROWS ─────────────────────────────────────────────────────────────

  // customText may be a JSON-encoded signing value { from, stampedAt, hijriStampedAt }
  // or a legacy plain string (from value only).
  let signingFrom = '';
  let signingStampedAt = '';
  let signingHijriStampedAt = '';

  if (field?.customText) {
    try {
      const parsed: unknown = JSON.parse(field.customText);
      if (parsed !== null && typeof parsed === 'object') {
        if ('from' in parsed && typeof parsed.from === 'string') signingFrom = parsed.from;
        if ('stampedAt' in parsed && typeof parsed.stampedAt === 'string')
          signingStampedAt = parsed.stampedAt;
        if ('hijriStampedAt' in parsed && typeof parsed.hijriStampedAt === 'string')
          signingHijriStampedAt = parsed.hijriStampedAt;
      }
    } catch {
      signingFrom = field.customText;
    }
  }

  const initialValueValue = signingFrom || fieldMeta?.initialValue || '';

  const normalizeDate = (date: string): string => {
    if (!date) return '';
    if (/^\d{2}\/\d{2}\/\d{4}$/.test(date)) return date;
    const d = new Date(date.length === 10 ? `${date}T12:00:00` : date);
    if (isNaN(d.getTime())) return date;
    return d.toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' });
  };

  const adDateFormatted = normalizeDate(signingStampedAt);
  const hijriFormatted = signingHijriStampedAt;

  const dateValue =
    adDateFormatted && hijriFormatted
      ? `${adDateFormatted} - ${hijriFormatted}`
      : adDateFormatted || hijriFormatted;

  const externalId = fieldMeta?.envelopeExternalId || '';
  const numberOfDocuments =
    fieldMeta?.totalAttachments ?? (fieldMeta?.envelopeItems ? `${fieldMeta.envelopeItems}` : '');

  const direction = fieldMeta?.direction ?? 'inbox';

  let rowY = HEADER_HEIGHT;

  const rows =
    lang === 'english'
      ? [
          { label: 'Number', value: externalId },
          { label: 'Date', value: dateValue },
          { label: direction === 'inbox' ? 'Received From' : 'Send To', value: initialValueValue },
          { label: 'Attachments', value: numberOfDocuments },
        ]
      : [
          { label: 'رقم', value: externalId },
          { label: 'التاريخ', value: dateValue },
          { label: direction === 'inbox' ? 'وارد من' : 'صادر الى', value: initialValueValue },
          { label: 'المرفقات', value: numberOfDocuments },
        ];

  for (const row of rows) {
    addRow(estampGroup, row.label, row.value, rowY, lang);
    rowY += ROW_HEIGHT;
  }

  // ── BARCODE ROW ──────────────────────────────────────────────────────────
  if (externalId) {
    const barcodeCanvas = document.createElement('canvas');
    try {
      JsBarcode(barcodeCanvas, externalId, {
        format: 'CODE128',
        width: 1,
        height: BARCODE_ROW_HEIGHT - 6,
        displayValue: false,
        margin: 0,
      });

      const barcodeImg = new window.Image();
      barcodeImg.src = barcodeCanvas.toDataURL('image/png');

      const barcodeWidth = STAMP_WIDTH * 0.5;
      const barcodeKonva = new Konva.Image({
        image: barcodeImg,
        x: (STAMP_WIDTH - barcodeWidth) / 2,
        y: rowY + 3,
        width: barcodeWidth,
        height: BARCODE_ROW_HEIGHT - 6,
      });

      barcodeImg.onload = () => {
        estampGroup.getLayer()?.batchDraw();
      };

      estampGroup.add(barcodeKonva);
    } catch {
      // If barcode generation fails (e.g. invalid chars), skip it
    }
  }

  return estampGroup;
};

export const renderEstampFieldElement = (
  field: FieldToRender,
  options: RenderFieldElementOptions,
) => {
  const { mode = 'edit', pageLayer, color } = options;

  const isFirstRender = !pageLayer.findOne(`#${field.renderId}`);

  const fieldGroup = upsertFieldGroup(field, options);

  // Clear previous children and listeners to re-render fresh.
  fieldGroup.removeChildren();
  fieldGroup.off('transform');

  if (isFirstRender) {
    pageLayer.add(fieldGroup);
  }

  const fieldRect = upsertFieldRect(field, options);
  const fieldEstamp = createFieldEstamp(field);

  fieldGroup.add(fieldRect);
  fieldGroup.add(fieldEstamp);

  fieldGroup.on('transform', () => {
    const groupScaleX = fieldGroup.scaleX();
    const groupScaleY = fieldGroup.scaleY();

    fieldEstamp.scaleX(1 / groupScaleX);
    fieldEstamp.scaleY(1 / groupScaleY);

    fieldGroup.getLayer()?.batchDraw();
  });

  fieldGroup.on('transformend', () => {
    fieldEstamp.scaleX(1);
    fieldEstamp.scaleY(1);

    fieldGroup.getLayer()?.batchDraw();
  });

  if (mode === 'export') {
    fieldRect.opacity(0);
  }

  if (color !== 'readOnly' && mode !== 'export') {
    createFieldHoverInteraction({ fieldGroup, fieldRect, options });
  }

  return {
    fieldGroup,
    isFirstRender,
  };
};
