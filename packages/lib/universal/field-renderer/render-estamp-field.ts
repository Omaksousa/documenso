import Konva from 'konva';

import sharakatLogo from '@documenso/assets/static/sharakat-logo.png';

import {
  createFieldHoverInteraction,
  upsertFieldGroup,
  upsertFieldRect,
} from './field-generic-items';
import type { FieldToRender, RenderFieldElementOptions } from './field-renderer';

const STAMP_WIDTH = 210;
const HEADER_HEIGHT = 48;
const ROW_HEIGHT = 22;
const NUM_ROWS = 4; // رقم, التاريخ, وارد من, المرفقات
const STAMP_HEIGHT = HEADER_HEIGHT + ROW_HEIGHT * NUM_ROWS;

const BORDER_COLOR = '#1B3A6B';
const TEXT_COLOR = '#1B3A6B';
const FONT_FAMILY = 'Arial, sans-serif';

// Column split: value on left, label on right
const LABEL_COL_WIDTH = 80;
const VALUE_COL_WIDTH = STAMP_WIDTH - LABEL_COL_WIDTH;
const INNER_PADDING = 4;

const addRow = (
  group: Konva.Group,
  label: string,
  value: string,
  yOffset: number,
  fontSize = 8,
) => {
  // Vertical divider between value (left) and label (right)
  group.add(
    new Konva.Line({
      points: [VALUE_COL_WIDTH, yOffset, VALUE_COL_WIDTH, yOffset + ROW_HEIGHT],
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

  // Label — right column, right-aligned (Arabic RTL)
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
};

const createFieldEstamp = (field: FieldToRender): Konva.Group => {
  const fieldMeta = field.fieldMeta?.type === 'estamp' ? field.fieldMeta : undefined;
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

  const dateValue = fieldMeta?.stampedAt
    ? new Date(fieldMeta.stampedAt).toLocaleDateString('en-GB', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
      })
    : '';

  const externalId = fieldMeta?.envelopeExternalId || '';
  const numberOfDocuments = fieldMeta?.envelopeItems ? `${fieldMeta?.envelopeItems}` : '';

  // customText is the user signed value while receivedFrom is the initial value by the envelope creator
  const receivedFromValue = field?.customText || fieldMeta?.receivedFrom || '';

  let rowY = HEADER_HEIGHT;

  addRow(estampGroup, 'رقم :', externalId, rowY);
  rowY += ROW_HEIGHT;

  addRow(estampGroup, 'التاريخ :', dateValue, rowY);
  rowY += ROW_HEIGHT;

  addRow(estampGroup, 'وارد من :', receivedFromValue, rowY);
  rowY += ROW_HEIGHT;

  addRow(estampGroup, 'المرفقات :', numberOfDocuments, rowY);

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
