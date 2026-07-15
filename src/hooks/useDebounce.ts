import { useState, useEffect } from 'react';

// Sử dụng Generic type <T> để hook có thể dùng cho string, number, array...
export function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);

  useEffect(() => {
    // Đặt bộ đếm thời gian
    const timer = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    // Dọn dẹp (clear) bộ đếm nếu người dùng tiếp tục gõ trước khi hết delay
    return () => {
      clearTimeout(timer);
    };
  }, [value, delay]); // Hook sẽ chạy lại mỗi khi value hoặc delay thay đổi

  return debouncedValue;
}