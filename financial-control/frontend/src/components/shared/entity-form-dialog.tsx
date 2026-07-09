'use client';

import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { Dialog } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

export type FieldSpec =
  | {
      name: string;
      label: string;
      type: 'text' | 'number' | 'date';
      required?: boolean;
      placeholder?: string;
    }
  | {
      name: string;
      label: string;
      type: 'select';
      options: { value: string; label: string }[];
      required?: boolean;
    }
  | { name: string; label: string; type: 'checkbox' };

interface EntityFormDialogProps<T> {
  open: boolean;
  title: string;
  fields: FieldSpec[];
  defaultValues: Partial<T>;
  onSubmit: (values: Partial<T>) => void;
  onClose: () => void;
  submitting?: boolean;
}

// T é intencionalmente sem constraint: as entidades são `interface`, que não
// satisfazem `Record<string, unknown>`. O formulário opera internamente sobre
// Record<string, unknown> e converte nas fronteiras (defaultValues/onSubmit).
export function EntityFormDialog<T>({
  open,
  title,
  fields,
  defaultValues,
  onSubmit,
  onClose,
  submitting,
}: EntityFormDialogProps<T>) {
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<Record<string, unknown>>({
    defaultValues: defaultValues as Record<string, unknown>,
  });

  // Reset ao abrir/trocar o registro editado
  useEffect(() => {
    if (open) reset(defaultValues as Record<string, unknown>);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  function submit(raw: Record<string, unknown>) {
    // Projeta o payload SOMENTE sobre os campos declarados. Na edição, o
    // react-hook-form retém chaves não-registradas vindas dos defaultValues
    // (id, createdAt, updatedAt, deletedAt, projectId…); enviá-las causaria
    // 400 no backend, que roda com forbidNonWhitelisted: true. Também descarta
    // strings vazias e NaN (campos opcionais não preenchidos — number vazio
    // com valueAsNumber vira NaN) para não mandar valores inválidos.
    const cleaned: Record<string, unknown> = {};
    for (const field of fields) {
      const v = raw[field.name];
      if (v === '' || v === undefined) continue;
      if (typeof v === 'number' && Number.isNaN(v)) continue;
      cleaned[field.name] = v;
    }
    onSubmit(cleaned as Partial<T>);
  }

  return (
    <Dialog open={open} onClose={onClose} title={title}>
      <form onSubmit={handleSubmit(submit)} className="space-y-3">
        {fields.map((field) => (
          <div key={field.name} className="space-y-1">
            {field.type !== 'checkbox' && (
              <Label htmlFor={field.name}>
                {field.label}
                {'required' in field && field.required && (
                  <span className="text-red-500"> *</span>
                )}
              </Label>
            )}

            {field.type === 'select' ? (
              <select
                id={field.name}
                className="h-9 w-full rounded-md border border-gray-300 bg-white px-2 text-sm"
                {...register(field.name, {
                  required: field.required ? 'Campo obrigatório' : false,
                })}
              >
                <option value="">Selecione…</option>
                {field.options.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            ) : field.type === 'checkbox' ? (
              <label className="flex items-center gap-2 text-sm text-gray-700">
                <input type="checkbox" {...register(field.name)} />
                {field.label}
              </label>
            ) : (
              <Input
                id={field.name}
                type={field.type === 'number' ? 'number' : field.type === 'date' ? 'date' : 'text'}
                placeholder={'placeholder' in field ? field.placeholder : undefined}
                step={field.type === 'number' ? 'any' : undefined}
                {...register(field.name, {
                  required:
                    'required' in field && field.required
                      ? 'Campo obrigatório'
                      : false,
                  valueAsNumber: field.type === 'number',
                })}
              />
            )}

            {errors[field.name] && (
              <p className="text-xs text-red-500">
                {String(errors[field.name]?.message)}
              </p>
            )}
          </div>
        ))}

        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="outline" onClick={onClose} disabled={submitting}>
            Cancelar
          </Button>
          <Button type="submit" disabled={submitting}>
            {submitting ? 'Salvando…' : 'Salvar'}
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
