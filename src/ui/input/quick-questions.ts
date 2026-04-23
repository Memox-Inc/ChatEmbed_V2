export function createQuickQuestions(
  questions: string[],
  onSelect: (question: string) => void,
  permanent: boolean,
): HTMLDivElement {
  const container = document.createElement('div');
  container.className = 'mcx-quick-questions';

  questions.forEach((q, i) => {
    const btn = document.createElement('button');
    btn.className = 'mcx-qr';
    btn.textContent = q;
    btn.style.animationDelay = `${i * 80}ms`;

    btn.addEventListener('click', () => {
      onSelect(q);
      if (!permanent) {
        container.style.display = 'none';
      }
    });
    container.appendChild(btn);
  });

  return container;
}
