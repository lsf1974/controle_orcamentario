'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';
import { api } from '@/lib/api';
import { extractApiMessage } from '@/lib/crud-api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import type { NotificationConfig, NotificationChannel } from '@/types';

const CHANNELS: { value: NotificationChannel; label: string }[] = [
  { value: 'EMAIL', label: 'E-mail' },
  { value: 'TELEGRAM', label: 'Telegram' },
  { value: 'WHATSAPP', label: 'WhatsApp' },
];

type ChannelFormValues = {
  isActive: boolean;
  alertDueToday: boolean;
  alertDueTodayTime: string;
  alertOverdue: boolean;
  alertPendingApproval: boolean;
  alertDailySummary: boolean;
  alertDailySummaryTime: string;
};

function ChannelForm({
  channel,
  label,
  config,
}: {
  channel: NotificationChannel;
  label: string;
  config?: NotificationConfig;
}) {
  const qc = useQueryClient();
  const { register, handleSubmit } = useForm<ChannelFormValues>({
    defaultValues: {
      isActive: config?.isActive ?? false,
      alertDueToday: config?.alertDueToday ?? true,
      alertDueTodayTime: config?.alertDueTodayTime ?? '08:00',
      alertOverdue: config?.alertOverdue ?? true,
      alertPendingApproval: config?.alertPendingApproval ?? true,
      alertDailySummary: config?.alertDailySummary ?? false,
      alertDailySummaryTime: config?.alertDailySummaryTime ?? '08:00',
    },
  });

  const save = useMutation({
    mutationFn: (values: ChannelFormValues) =>
      api.put(`/notification-config/${channel}`, values),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['notification-config'] });
      toast.success(`Notificações de ${label} salvas`);
    },
    onError: (err) => toast.error(extractApiMessage(err)),
  });

  return (
    <form
      onSubmit={handleSubmit((v) => save.mutate(v))}
      className="space-y-3 rounded-lg border bg-white p-4"
    >
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-gray-800">{label}</h2>
        <label className="flex items-center gap-2 text-sm text-gray-700">
          <input type="checkbox" {...register('isActive')} />
          Canal ativo
        </label>
      </div>

      <label className="flex items-center gap-2 text-sm text-gray-700">
        <input type="checkbox" {...register('alertDueToday')} />
        Alertar vencimentos do dia
      </label>
      <div className="flex items-center gap-2">
        <Label htmlFor={`${channel}-dueTime`} className="text-sm">Horário</Label>
        <Input id={`${channel}-dueTime`} type="time" className="w-32" {...register('alertDueTodayTime')} />
      </div>

      <label className="flex items-center gap-2 text-sm text-gray-700">
        <input type="checkbox" {...register('alertOverdue')} />
        Alertar contas em atraso
      </label>

      <label className="flex items-center gap-2 text-sm text-gray-700">
        <input type="checkbox" {...register('alertPendingApproval')} />
        Alertar lançamentos aguardando aprovação
      </label>

      <label className="flex items-center gap-2 text-sm text-gray-700">
        <input type="checkbox" {...register('alertDailySummary')} />
        Enviar resumo diário
      </label>
      <div className="flex items-center gap-2">
        <Label htmlFor={`${channel}-dailyTime`} className="text-sm">Horário do resumo</Label>
        <Input id={`${channel}-dailyTime`} type="time" className="w-32" {...register('alertDailySummaryTime')} />
      </div>

      <div className="flex justify-end">
        <Button type="submit" disabled={save.isPending}>
          {save.isPending ? 'Salvando…' : 'Salvar'}
        </Button>
      </div>
    </form>
  );
}

export default function NotificacoesPage() {
  const { data, isLoading } = useQuery({
    queryKey: ['notification-config'],
    queryFn: async () =>
      (await api.get<NotificationConfig[]>('/notification-config')).data,
  });

  if (isLoading) {
    return <p className="py-8 text-center text-sm text-gray-500">Carregando…</p>;
  }

  const byChannel = new Map((data ?? []).map((c) => [c.channel, c]));

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-bold text-gray-800">Minhas Notificações</h1>
      <div className="grid gap-4 md:grid-cols-2">
        {CHANNELS.map((ch) => (
          <ChannelForm
            key={ch.value}
            channel={ch.value}
            label={ch.label}
            config={byChannel.get(ch.value)}
          />
        ))}
      </div>
    </div>
  );
}
