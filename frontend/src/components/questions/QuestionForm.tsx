import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { ChoiceEditor } from '@/components/questions/ChoiceEditor';
import { useChapters } from '@/hooks/useSubjects';
import type { ChoiceInput, Difficulty, QuestionPayload, QuestionType, Subject } from '@/types';

export interface QuestionFormValues {
  subject_id: string;
  chapter_id: string;
  content: string;
  difficulty: Difficulty;
  question_type: QuestionType;
  choices: ChoiceInput[];
}

interface QuestionFormProps {
  subjects: Subject[];
  defaultValues?: Partial<QuestionFormValues>;
  submitting?: boolean;
  onSubmit: (payload: QuestionPayload) => void;
  onCancel: () => void;
}

const emptyChoices: ChoiceInput[] = [
  { content: '', is_correct: false },
  { content: '', is_correct: false },
];

export function QuestionForm({ subjects, defaultValues, submitting, onSubmit, onCancel }: QuestionFormProps) {
  const { register, handleSubmit, watch, setValue, control, formState } = useForm<QuestionFormValues>({
    defaultValues: {
      subject_id: defaultValues?.subject_id ?? subjects[0]?.id ?? '',
      chapter_id: defaultValues?.chapter_id ?? '',
      content: defaultValues?.content ?? '',
      difficulty: defaultValues?.difficulty ?? 'easy',
      question_type: defaultValues?.question_type ?? 'single_choice',
      choices: defaultValues?.choices?.length ? defaultValues.choices : emptyChoices,
    },
  });

  const subjectId = watch('subject_id');
  const questionType = watch('question_type');
  const { data: chapters = [] } = useChapters(subjectId);

  // If a subject with no matching chapter is selected, clear the stale chapter_id.
  useEffect(() => {
    if (chapters.length > 0 && !chapters.some((c) => c.id === watch('chapter_id'))) {
      setValue('chapter_id', chapters[0]?.id ?? '');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chapters]);

  function submit(values: QuestionFormValues) {
    const correctCount = values.choices.filter((c) => c.is_correct).length;
    if (correctCount === 0) {
      window.alert('Vui lòng chọn ít nhất một đáp án đúng.');
      return;
    }
    const payload: QuestionPayload = {
      subject_id: values.subject_id,
      chapter_id: values.chapter_id,
      content: values.content,
      difficulty: values.difficulty,
      question_type: values.question_type,
      choices: values.choices.filter((c) => c.content.trim().length > 0),
    };
    onSubmit(payload);
  }

  return (
    <form onSubmit={handleSubmit(submit)} className="space-y-4">
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
          <label className="block text-sm font-medium text-neutral-700">Chương</label>
          <select
            {...register('chapter_id', { required: true })}
            className="mt-1 w-full rounded-md border border-neutral-300 px-3 py-1.5 text-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
          >
            {chapters.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-neutral-700">Nội dung câu hỏi</label>
        <textarea
          {...register('content', { required: true })}
          rows={3}
          className="mt-1 w-full rounded-md border border-neutral-300 px-3 py-1.5 text-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
          placeholder="Nhập nội dung câu hỏi..."
        />
        {formState.errors.content && <p className="mt-1 text-xs text-danger-600">Nội dung là bắt buộc.</p>}
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-neutral-700">Độ khó</label>
          <select
            {...register('difficulty')}
            className="mt-1 w-full rounded-md border border-neutral-300 px-3 py-1.5 text-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
          >
            <option value="easy">Dễ</option>
            <option value="medium">Trung bình</option>
            <option value="hard">Khó</option>
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-neutral-700">Loại câu hỏi</label>
          <select
            {...register('question_type')}
            className="mt-1 w-full rounded-md border border-neutral-300 px-3 py-1.5 text-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
          >
            <option value="single_choice">Một đáp án đúng</option>
            <option value="multi_choice">Nhiều đáp án đúng</option>
          </select>
        </div>
      </div>

      <ChoiceEditor control={control} questionType={questionType} />

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
          {submitting ? 'Đang lưu...' : 'Lưu câu hỏi'}
        </button>
      </div>
    </form>
  );
}
