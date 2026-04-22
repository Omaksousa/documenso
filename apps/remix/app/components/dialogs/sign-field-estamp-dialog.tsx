import { useEffect, useRef } from 'react';

import { zodResolver } from '@hookform/resolvers/zod';
import { msg } from '@lingui/core/macro';
import { useLingui } from '@lingui/react/macro';
import { Trans } from '@lingui/react/macro';
import { createCallable } from 'react-call';
import { useForm, useWatch } from 'react-hook-form';
import { z } from 'zod';

import type { TEstampFieldMeta } from '@documenso/lib/types/field-meta';
import {
  convertGregorianToHijri,
  dateDifferenceInDays,
} from '@documenso/lib/utils/hijri-converter';
import { cn } from '@documenso/ui/lib/utils';
import { Button } from '@documenso/ui/primitives/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@documenso/ui/primitives/dialog';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@documenso/ui/primitives/form/form';
import { Input } from '@documenso/ui/primitives/input';

export type TEstampSigningValue = {
  from: string;
  stampedAt: string; // DD/MM/YYYY
  hijriStampedAt: string; // DD/MM/YYYY
};

const isoToDDMMYYYY = (iso: string): string => {
  if (!iso || iso.length !== 10) return '';
  const [y, m, d] = iso.split('-');
  return `${d}/${m}/${y}`;
};

const anyDateToIso = (date: string): string => {
  if (!date) return '';
  // DD/MM/YYYY
  if (/^\d{2}\/\d{2}\/\d{4}$/.test(date)) {
    const [d, m, y] = date.split('/');
    return `${y}-${m}-${d}`;
  }
  // YYYY-MM-DD or full ISO/timezone string
  const parsed = new Date(date.length === 10 ? `${date}T12:00:00` : date);
  if (isNaN(parsed.getTime())) return '';
  const y = parsed.getFullYear();
  const m = String(parsed.getMonth() + 1).padStart(2, '0');
  const d = String(parsed.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
};

const ZDDMMYYYYDate = z
  .string()
  .regex(/^\d{2}\/\d{2}\/\d{4}$/, { message: 'Format must be DD/MM/YYYY' })
  .refine(
    (val) => {
      const [dd, mm] = val.split('/').map(Number);
      return dd >= 1 && dd <= 31 && mm >= 1 && mm <= 12;
    },
    { message: 'Invalid Date' },
  )
  .optional();

const ZSignFieldEstampFormSchema = z.object({
  from: z.string().min(1, { message: msg`From is required`.id }),
  stampedAt: z.string().optional(), // ISO YYYY-MM-DD internally
  hijriStampedAt: ZDDMMYYYYDate,
});

type TSignFieldEstampFormSchema = z.infer<typeof ZSignFieldEstampFormSchema>;

type DatePickerInputProps = {
  value: string;
  onChange: (iso: string) => void;
};

const DatePickerInput = ({ value, onChange }: DatePickerInputProps) => {
  const hiddenRef = useRef<HTMLInputElement>(null);

  return (
    <div className="relative">
      <Input
        readOnly
        placeholder="DD/MM/YYYY"
        value={isoToDDMMYYYY(value)}
        onClick={() => hiddenRef.current?.showPicker?.()}
        onBlur={() => hiddenRef.current?.blur()}
        className="cursor-pointer"
      />
      <input
        ref={hiddenRef}
        type="date"
        className="pointer-events-none absolute inset-0 opacity-0"
        tabIndex={-1}
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
    </div>
  );
};

export type SignFieldEstampDialogProps = {
  fieldMeta?: TEstampFieldMeta;
};

export const SignFieldEstampDialog = createCallable<
  SignFieldEstampDialogProps,
  TEstampSigningValue | null
>(({ call, fieldMeta }) => {
  const { t } = useLingui();

  const form = useForm<TSignFieldEstampFormSchema>({
    resolver: zodResolver(ZSignFieldEstampFormSchema),
    defaultValues: {
      from: fieldMeta?.initialValue || '',
      stampedAt: '',
      hijriStampedAt: '',
    },
  });

  const { control, setValue } = form;
  const stampedAt = useWatch({ control, name: 'stampedAt' });

  // Auto-fill Hijri when AD date changes.
  useEffect(() => {
    if (stampedAt) {
      setValue('hijriStampedAt', convertGregorianToHijri(isoToDDMMYYYY(stampedAt)), {
        shouldValidate: true,
      });
    } else {
      setValue('hijriStampedAt', '');
    }
  }, [stampedAt]);

  const onSubmit = (data: TSignFieldEstampFormSchema) => {
    call.end({
      from: data.from,
      stampedAt: isoToDDMMYYYY(data.stampedAt ?? ''),
      hijriStampedAt: data.hijriStampedAt ?? '',
    });
  };

  return (
    <Dialog open={true} onOpenChange={(value) => (!value ? call.end(null) : null)}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            <Trans>Enter Stamp Details</Trans>
          </DialogTitle>
          <DialogDescription className="mt-4">
            <Trans>Please enter the stamp details</Trans>
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)}>
            <fieldset
              className="flex h-full flex-col space-y-4"
              disabled={form.formState.isSubmitting}
            >
              <FormField
                control={form.control}
                name="from"
                render={({ field, fieldState }) => (
                  <FormItem>
                    <FormLabel>
                      {fieldMeta?.direction === 'outbox' ? (
                        <Trans>Send To</Trans>
                      ) : (
                        <Trans>Received From</Trans>
                      )}
                    </FormLabel>
                    <FormControl>
                      <Input
                        id="custom-text"
                        placeholder={fieldMeta?.placeholder ?? t`Enter your text here`}
                        className={cn('w-full rounded-md', {
                          'border-2 border-red-300 text-left ring-2 ring-red-200 ring-offset-2 ring-offset-red-200 focus-visible:border-red-400 focus-visible:ring-4 focus-visible:ring-red-200 focus-visible:ring-offset-2 focus-visible:ring-offset-red-200':
                            fieldState.error,
                        })}
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="stampedAt"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>
                      <Trans>AD Date</Trans>
                    </FormLabel>
                    <FormControl>
                      <DatePickerInput value={field.value ?? ''} onChange={field.onChange} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="hijriStampedAt"
                render={({ field }) => {
                  const diff = dateDifferenceInDays(
                    isoToDDMMYYYY(stampedAt ?? ''),
                    field.value ?? '',
                  );
                  const showWarning = diff !== null && diff > 2;
                  return (
                    <FormItem>
                      <FormLabel>
                        <Trans>Hijri Date</Trans>
                      </FormLabel>
                      <FormControl>
                        <Input placeholder="DD/MM/YYYY" {...field} value={field.value ?? ''} />
                      </FormControl>
                      <FormMessage />
                      {showWarning && (
                        <p className="text-sm text-yellow-600">
                          <Trans>The AD and Hijri dates are more than 2 days apart.</Trans>
                        </p>
                      )}
                    </FormItem>
                  );
                }}
              />

              <DialogFooter>
                <Button type="button" variant="secondary" onClick={() => call.end(null)}>
                  <Trans>Cancel</Trans>
                </Button>
                <Button type="submit">
                  <Trans>Enter</Trans>
                </Button>
              </DialogFooter>
            </fieldset>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
});
