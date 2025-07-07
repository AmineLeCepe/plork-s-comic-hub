let index = 0;
const track = document.querySelector('.carousel-track');
const items = document.querySelectorAll('.carousel-item');
const totalItems = items.length;

// Function to update the carousel position
function updateCarousel() {
    track.style.transform = `translateX(-${index * 100}%)`;
}

document.querySelector('.carousel-btn.next').onclick = () => {
    index = (index + 1) % totalItems; // Loop back to the first item after the last one
    updateCarousel();
};

document.querySelector('.carousel-btn.prev').onclick = () => {
    index = (index - 1 + totalItems) % totalItems; // Loop to the last item when going back from the first one
    updateCarousel();
};