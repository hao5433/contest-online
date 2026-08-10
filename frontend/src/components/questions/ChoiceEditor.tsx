import { useFieldArray, type Control } from 'react-hook-form';
import type { QuestionFormValues } from '@/components/questions/QuestionForm';
import type { QuestionType } from '@/types';

interface ChoiceEditorProps {
  control: Control<QuestionFormValues>;
  questionType: QuestionType;
}

/**
 * Dynamic add/remove rows for question choices. Correctness is toggled via a
 * radio group for single_choice (only one correct answer) or checkboxes for
 * multi_choice (several correct answers allowed).
 */
export function ChoiceEditor({ control, questionType }: ChoiceEditorProps) {
  const { fields, append, remove, update } = useFieldArray({ control, name: 'choices' });

  function toggleCorrect(index: number, checked: boolean) {
    if (questionType === 'single_choice') {
      fields.forEach((field, i) => {
        update(i, { ...field, is_correct: i === index });
      });
    } else {
      const current = fields[index];
      update(index, { ...current, is_correct: checked });
    }
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <label className="block text-sm font-medium text-neutral-700">Đáp án</label>
        <button
          type="button"
          onClick={() => append({ content: '', is_correct: false })}
          className="text-sm font-medium text-primary-600 hover:text-primary-700"
        >
          + Thêm đáp án
        </button>
      </div>

      {fields.map((field, index) => (
        <div key={field.id} className="flex items-center gap-2">
          <input
            type={questionType === 'single_choice' ? 'radio' : 'checkbox'}
            name={questionType === 'single_choice' ? 'correct-choice' : undefined}
            checked={field.is_correct}
            onChange={(e) => toggleCorrect(index, e.target.checked)}
            className="h-4 w-4 shrink-0 accent-primary-500"
            aria-label="Đáp án đúng"
          />
          <input
            type="text"
            value={field.content}
            onChange={(e) => update(index, { ...field, content: e.target.value })}
            placeholder={`Nội dung đáp án ${index + 1}`}
            className="flex-1 rounded-md border border-neutral-300 px-3 py-1.5 text-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
          />
          <button
            type="button"
            onClick={() => remove(index)}
            disabled={fields.length <= 2}
            className="rounded p-1.5 text-neutral-400 hover:bg-neutral-100 hover:text-danger-600 disabled:cursor-not-allowed disabled:opacity-40"
            aria-label="Xoá đáp án"
          >
            ✕
          </button>
        </div>
      ))}
      <p className="text-xs text-neutral-500">
        {questionType === 'single_choice'
          ? 'Chọn đúng một đáp án đúng.'
          : 'Có thể chọn nhiều đáp án đúng.'}
      </p>
    </div>
  );
}
