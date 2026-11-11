// Cấu hình bộ đếm lượt xem / lượt tải.
// Để trống các giá trị firebase: trang vẫn chạy bình thường, chỉ hiện dấu "–" thay cho số đếm.
// Cách điền: xem README.md (Bước 2).
window.SITE_CONFIG = {
  firebase: {
    apiKey: "AIzaSyBP056bLWRtL6ahrj0JY9ZlXHbN3WegnNg",
    authDomain: "eng10-29a1e.firebaseapp.com",
    projectId: "eng10-29a1e",
    appId: "1:993897791789:web:39e4ba9856536bda4c13a4"
  },
  // Chỉ hiện số đếm khi giá trị >= ngưỡng này. Đặt 0 để luôn hiện.
  // Gợi ý: nếu số còn nhỏ, đặt 10 để trang không trông vắng.
  hienThiToiThieu: 0
};
