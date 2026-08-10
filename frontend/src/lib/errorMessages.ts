/**
 * The backend's HTTPException `detail` strings are written in English (they're
 * dev-facing by convention). This maps the known/static ones to Vietnamese so
 * the UI stays consistent. Unknown or dynamic (f-string) messages - e.g. Excel
 * import row errors - pass through untranslated rather than disappearing.
 */
const KNOWN_ERROR_TRANSLATIONS: Record<string, string> = {
  'A question needs at least 1 correct choice': 'Câu hỏi cần có ít nhất 1 đáp án đúng',
  'A question needs at least 2 choices': 'Câu hỏi cần có ít nhất 2 lựa chọn',
  'Account is deactivated': 'Tài khoản đã bị khoá',
  'Attempt is no longer in progress': 'Lượt thi này đã kết thúc, không thể tiếp tục làm bài',
  'Attempt is still in progress': 'Bài thi đang được làm, chưa thể xem kết quả',
  'Attempt not found': 'Không tìm thấy lượt thi',
  'Cannot delete: this question is used by one or more exams': 'Không thể xoá: câu hỏi này đang được dùng trong ít nhất 1 đề thi',
  'Cannot delete: this classroom still has exams assigned to it': 'Không thể xoá: lớp này vẫn còn đề thi được giao',
  'Chapter does not belong to this subject': 'Chương này không thuộc môn học đã chọn',
  'Chapter not found': 'Không tìm thấy chương',
  'Classroom not found': 'Không tìm thấy lớp học',
  'Could not validate credentials': 'Phiên đăng nhập không hợp lệ, vui lòng đăng nhập lại',
  'Current password is incorrect': 'Mật khẩu hiện tại không đúng',
  'Email already registered': 'Email này đã được đăng ký',
  'Exam has already ended': 'Đề thi đã kết thúc',
  'Exam has not started yet': 'Đề thi chưa đến giờ bắt đầu',
  'Exam is not open for attempts': 'Đề thi chưa được xuất bản hoặc đã đóng',
  'Exam not found': 'Không tìm thấy đề thi',
  'Invalid email or password': 'Email hoặc mật khẩu không đúng',
  'Invalid refresh token': 'Phiên đăng nhập đã hết hạn, vui lòng đăng nhập lại',
  'No user with this email': 'Không tìm thấy tài khoản với email này',
  'Not allowed to view this attempt': 'Bạn không có quyền xem lượt thi này',
  'Not enough permissions': 'Bạn không có quyền thực hiện hành động này',
  'Not your attempt': 'Đây không phải lượt thi của bạn',
  'Not your classroom': 'Đây không phải lớp học của bạn',
  'Question is not part of this attempt': 'Câu hỏi này không thuộc đề thi đang làm',
  'Question not found': 'Không tìm thấy câu hỏi',
  'Subject not found': 'Không tìm thấy môn học',
  'This student is already enrolled in this classroom': 'Học sinh này đã ở trong lớp rồi',
  'This student is not enrolled here': 'Học sinh này không ở trong lớp này',
  'This user is not a student': 'Tài khoản này không phải học sinh',
  'Too many failed login attempts. Please try again in a few minutes.':
    'Đăng nhập sai quá nhiều lần. Vui lòng thử lại sau vài phút.',
  'User not found': 'Không tìm thấy người dùng',
  'You have already attempted this exam': 'Bạn đã làm bài thi này rồi - mỗi đề thi chỉ được làm 1 lần',
  'single_choice questions must have exactly 1 correct choice': 'Câu hỏi một đáp án chỉ được có đúng 1 lựa chọn đúng',
};

export function translateErrorDetail(detail: string): string {
  return KNOWN_ERROR_TRANSLATIONS[detail] ?? detail;
}
