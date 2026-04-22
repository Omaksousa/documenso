import { useEffect } from 'react';

import { zodResolver } from '@hookform/resolvers/zod';
import { Trans, useLingui } from '@lingui/react/macro';
import { useForm, useWatch } from 'react-hook-form';
import type { z } from 'zod';

import type { TEstampFieldMeta } from '@documenso/lib/types/field-meta';
import { ZEstampFieldMeta } from '@documenso/lib/types/field-meta';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@documenso/ui/primitives/form/form';
import { Input } from '@documenso/ui/primitives/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@documenso/ui/primitives/select';

const ZEstampFieldMetaSchema = ZEstampFieldMeta.pick({
  initialValue: true,
  direction: true,
  readOnly: true,
  totalAttachments: true,
});

type TTextFieldFormSchema = z.infer<typeof ZEstampFieldMetaSchema>;

type EditorFieldEstampFormProps = {
  value: TEstampFieldMeta | undefined;
  onValueChange: (value: TEstampFieldMeta) => void;
  pageCount?: string;
};

export const EditorFieldEstampForm = ({
  value = {
    type: 'estamp',
    lang: 'arabic',
    direction: 'inbox',
    initialValue: '0',
  },
  onValueChange,
  pageCount,
}: EditorFieldEstampFormProps) => {
  const { t } = useLingui();

  const form = useForm<TTextFieldFormSchema>({
    resolver: zodResolver(ZEstampFieldMetaSchema),
    mode: 'onChange',
    defaultValues: {
      initialValue: value.initialValue || '0',
      direction: value.direction || 'inbox',
      readOnly: value.readOnly || false,
      totalAttachments: value.totalAttachments ?? pageCount,
    },
  });

  const { control, setValue, getValues } = form;

  const formValues = useWatch({ control });

  // Set totalAttachments default from pageCount once it resolves, but only if the user hasn't edited it.
  useEffect(() => {
    if (pageCount !== undefined && !value.totalAttachments && !getValues('totalAttachments')) {
      setValue('totalAttachments', pageCount, { shouldValidate: true });
    }
  }, [pageCount]);

  // Dupecode/Inefficient: Done because native isValid won't work for our usecase.
  useEffect(() => {
    const validatedFormValues = ZEstampFieldMetaSchema.safeParse(formValues);

    if (formValues.readOnly && !formValues.initialValue) {
      void form.trigger('initialValue');
    }

    if (validatedFormValues.success) {
      onValueChange({
        type: 'estamp',
        lang: value.lang,
        ...validatedFormValues.data,
      });
    }
  }, [formValues]);

  return (
    <Form {...form}>
      <form>
        <fieldset className="flex flex-col gap-2">
          <FormField
            control={form.control}
            name="direction"
            render={({ field }) => (
              <FormItem>
                <FormLabel>
                  <Trans>Direction</Trans>
                </FormLabel>
                <FormControl>
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger>
                      <SelectValue placeholder={t`Select direction`} />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="inbox">
                        <Trans>Inbox (وارد من)</Trans>
                      </SelectItem>
                      <SelectItem value="outbox">
                        <Trans>Outbox (صادر الى)</Trans>
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="initialValue"
            render={({ field }) => (
              <FormItem>
                <FormLabel>
                  {formValues.direction === 'outbox' ? (
                    <Trans>Send To</Trans>
                  ) : (
                    <Trans>Received From</Trans>
                  )}
                </FormLabel>
                <FormControl>
                  <Input data-testid="field-form-label" placeholder={t`Field From`} {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="totalAttachments"
            render={({ field }) => (
              <FormItem>
                <FormLabel>
                  <Trans>Attachments</Trans>
                </FormLabel>
                <FormControl>
                  <Input
                    placeholder={t`Number of attachments`}
                    {...field}
                    value={field.value ?? ''}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </fieldset>
      </form>
    </Form>
  );
};
