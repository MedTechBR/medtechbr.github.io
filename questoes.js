/* Páginas de questões: responder mostra certo ou errado e abre o comentário. */
(function () {
  var alts = document.querySelectorAll('.q-alt');
  if (!alts.length) return;
  var res = document.querySelector('.q-res'), det = document.querySelector('.q-det'), feito = false;
  alts.forEach(function (b) {
    b.addEventListener('click', function () {
      if (feito) return;
      feito = true;
      var ok = b.dataset.ok === '1';
      alts.forEach(function (x) { if (x.dataset.ok === '1') x.classList.add('certa'); });
      if (!ok) b.classList.add('errada');
      res.textContent = ok ? 'Você acertou.' : 'Não foi essa. A resposta correta está marcada.';
      det.open = true;
    });
  });
})();
