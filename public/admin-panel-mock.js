document.addEventListener('DOMContentLoaded', () => {
    function switchTab(clickedTab) {
        document.querySelectorAll('.tab').forEach(tab => tab.classList.remove('active'));
        if (clickedTab) clickedTab.classList.add('active');
    }

    document.querySelectorAll('.tab').forEach((tab) => {
        tab.addEventListener('click', function () { switchTab(this); }, { passive: true });
    });
});
