import { FieldType } from '@prisma/client';

import { AppError, AppErrorCode } from '@documenso/lib/errors/app-error';
import type { TFieldEstamp } from '@documenso/lib/types/field';
import type { TSignEnvelopeFieldValue } from '@documenso/trpc/server/envelope-router/sign-envelope-field.types';

import { SignFieldEstampDialog } from '~/components/dialogs/sign-field-estamp-dialog';

type HandleEstampFieldClickOptions = {
  field: TFieldEstamp;
  text: string | null;
};

export const handleEstampFieldClick = async (
  options: HandleEstampFieldClickOptions,
): Promise<Extract<TSignEnvelopeFieldValue, { type: typeof FieldType.ESTAMP }> | null> => {
  const { field, text } = options;

  if (field.type !== FieldType.ESTAMP) {
    throw new AppError(AppErrorCode.INVALID_REQUEST, {
      message: 'Invalid field type',
    });
  }

  if (field.inserted) {
    return {
      type: FieldType.ESTAMP,
      value: null,
    };
  }

  let textToInsert = text;

  if (!textToInsert) {
    textToInsert = await SignFieldEstampDialog.call({
      fieldMeta: field.fieldMeta,
    });
  }

  if (!textToInsert) {
    return null;
  }

  return {
    type: FieldType.ESTAMP,
    value: textToInsert,
  };
};
