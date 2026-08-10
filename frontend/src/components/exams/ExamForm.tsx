import { useForm } from 'react-hook-form';
import type { Classroom, ExamPayload, Subject } from '@/types';

interface ExamFormValues {
  title: string;
  subject_id: string;
  duration_minutes: number;
  easy: number;
  medium: number;
  hard: number;
  shuffle_questions: boolean;
  shuffle_choices: boolean;
  start_time: string;
  end_time: string;
  classroom_id: string;
}

interface ExamFormProps {
  subjects: Subject[];
  classrooms: Classroom[];
  defaultValues?: Partial<ExamPayload>;
  submitting?: boolean;
  onSubmit: (payload: ExamPayload) => void;
  onCancel: () => void;
}

/** Sentinel value for the "no classroom - visible to everyone" option, since
 * <select> options are always strings and we need to distinguish "not
 * selected yet" from "explicitly unscoped". */
const NO_CLASSROOM = '';

/** Converts an ISO datetime string to the `yyyy-MM-ddTHH:mm` shape <input type="datetime-local"> expects. */
function toDatetimeLocal(iso?: string): string {
  if (!iso) return '';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  const pad = (n: number) => n.toString().padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export function ExamForm({ subjects, classrooms, defaultValues, submitting, onSubmit, onCancel }: ExamFormProps) {
  const { register, handleSubmit } = useForm<ExamFormValues>({
    defaultValues: {
      title: defaultValues?.title ?? '',
      subject_id: defaultValues?.subject_id ?? subjects[0]?.id ?? '',
      duration_minutes: defaultValues?.duration_minutes ?? 60,
      easy: defaultValues?.difficulty_distribution?.easy ?? 5,
      medium: defaultValues?.difficulty_distribution?.medium ?? 3,
      hard: defaultValues?.difficulty_distribution?.hard ?? 2,
      shuffle_questions: defaultValues?.shuffle_questions ?? true,
      shuffle_choices: defaultValues?.shuffle_choices ?? true,
      start_time: toDatetimeLocal(defaultValues?.start_time),
      end_time: toDatetimeLocal(defaultValues?.end_time),
      classroom_id: defaultValues?.classroom_id ?? NO_CLASSROOM,
    },
  });

  function submit(values: ExamFormValues) {
    const payload: ExamPayload = {
      title: values.title,
      subject_id: values.subject_id,
      duration_minutes: Number(values.duration_minutes),
      difficulty_distribution: {
        easy: Number(values.easy),
        medium: Number(values.medium),
        hard: Number(values.hard),
      },
      shuffle_questions: values.shuffle_questions,
      shuffle_choices: values.shuffle_choices,
      start_time: new Date(values.start_time).toISOString(),
      end_time: new Date(values.end_time).toISOString(),
      classroom_id: values.classroom_id === NO_CLASSROOM ? null : values.classroom_id,
    };
    onSubmit(payload);
  }

  return (
    <form onSubmit={handleSubmit(submit)} className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-neutral-700">Tên đề thi</label>
        <input
          {...register('title', { required: true })}
          type="text"
          className="mt-1 w-full rounded-md border border-neutral-300 px-3 py-1.5 text-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
          placeholder="VD: Kiểm tra giữa kỳ - Toán 10"
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-neutral-700">Môn học</label>
          <select
            {...register('subject_id', { required: true })}
            className="mt-1 w-full rounded-md border border-neutral-300 px-3 py-1.5 text-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
          >
            {subjects.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-neutral-700">Thời gian làm bài (phút)</label>
          <input
            {...register('duration_minutes', { required: true, min: 1 })}
            type="number"
            min={1}
            className="mt-1 w-full rounded-md border border-neutral-300 px-3 py-1.5 text-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
          />
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-neutral-700">Giao cho lớp</label>
        <select
          {...register('classroom_id')}
          className="mt-1 w-full rounded-md border border-neutral-300 px-3 py-1.5 text-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
        >
          <option value={NO_CLASSROOM}>Tất cả học sinh (không giới hạn lớp)</option>
          {classrooms.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name} ({c.student_count} học sinh)
            </option>
          ))}
        </select>
        <p className="mt-1 text-xs text-neutral-500">
          Chọn 1 lớp để chỉ học sinh trong lớp đó thấy đề thi này; để "Tất cả học sinh" nếu muốn mọi học sinh đều
          thấy được.
        </p>
      </div>

      <div>
        <label className="block text-sm font-medium text-neutral-700">Số lượng câu hỏi theo độ khó</label>
        <div className="mt-1 grid grid-cols-3 gap-3">
          <div>
            <span className="text-xs text-neutral-500">Dễ</span>
            <input
              {...register('easy', { required: true, min: 0 })}
              type="number"
              min={0}
              className="mt-1 w-full rounded-md border border-neutral-300 px-3 py-1.5 text-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
            />
          </div>
          <div>
            <span className="text-xs text-neutral-500">Trung bình</span>
            <input
              {...register('medium', { required: true, min: 0 })}
              type="number"
              min={0}
              className="mt-1 w-full rounded-md border border-neutral-300 px-3 py-1.5 text-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
            />
          </div>
          <div>
            <span className="text-xs text-neutral-500">Khó</span>
            <input
              {...register('hard', { required: true, min: 0 })}
              type="number"
              min={0}
              className="mt-1 w-full rounded-md border border-neutral-300 px-3 py-1.5 text-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
            />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-neutral-700">Bắt đầu</label>
          <input
            {...register('start_time', { required: true })}
            type="datetime-local"
            className="mt-1 w-full rounded-md border border-neutral-300 px-3 py-1.5 text-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-neutral-700">Kết thúc</label>
          <input
            {...register('end_time', { required: true })}
            type="datetime-local"
            className="mt-1 w-full rounded-md border border-neutral-300 px-3 py-1.5 text-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
          />
        </div>
      </div>

      <div className="flex gap-6">
        <label className="flex items-center gap-2 text-sm text-neutral-700">
          <input type="checkbox" {...register('shuffle_questions')} className="h-4 w-4 accent-primary-500" />
          Trộn thứ tự câu hỏi
        </label>
        <label className="flex items-center gap-2 text-sm text-neutral-700">
          <input type="checkbox" {...register('shuffle_choices')} className="h-4 w-4 accent-primary-500" />
          Trộn thứ tự đáp án
        </label>
      </div>

      <div className="flex justify-end gap-2 pt-2">
        <button
          type="button"
          onClick={onCancel}
          className="rounded-md border border-neutral-300 px-3 py-1.5 text-sm font-medium text-neutral-700 hover:bg-neutral-50"
        >
          Huỷ
        </button>
        <button
          type="submit"
          disabled={submitting}
          className="rounded-md bg-primary-500 px-3 py-1.5 text-sm font-medium text-white hover:bg-primary-600 disabled:opacity-60"
        >
          {submitting ? 'Đang lưu...' : 'Lưu đề thi'}
        </button>
      </div>
    </form>
  );
}
