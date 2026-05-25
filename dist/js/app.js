// 表单数据收集与跳转
document.addEventListener('DOMContentLoaded', () => {
  const form = document.getElementById('baziForm');
  form.addEventListener('submit', e => {
    e.preventDefault();
    const params = {};
    Array.from(form.elements).forEach(item => {
      if (item.name)
        params[item.name] = item.value;
    });
    window.sessionStorage.setItem('reportParams', JSON.stringify(params));
    window.location.href = 'report.html';
  });
});

