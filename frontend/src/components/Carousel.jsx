/**
 * Image carousel - three slides with indicators and auto-advance.
 */
import { useState, useEffect } from 'react';
import './Carousel.css';

const SLIDES = [
  {
    img: 'https://images.unsplash.com/photo-1705083649602-03c5fbae2e89?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=1080',
    title: 'Ancient Wisdom',
    subtitle: 'Traditional Ayurvedic Healing',
  },
  {
    img: 'https://images.unsplash.com/photo-1724833190236-0c25b6c94e90?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=1080',
    title: 'Mind & Body',
    subtitle: 'Holistic Wellness Approach',
  },
  {
    img: 'https://images.unsplash.com/photo-1539207107274-c576d0d5b375?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=1080',
    title: 'Natural Healing',
    subtitle: 'Pure & Organic Medicine',
  },
];

export default function Carousel() {
  const [current, setCurrent] = useState(0);

  useEffect(() => {
    const id = setInterval(() => {
      setCurrent((c) => (c + 1) % SLIDES.length);
    }, 4000);
    return () => clearInterval(id);
  }, []);

  return (
    <div className="carousel-container">
      {SLIDES.map((slide, i) => (
        <div
          key={i}
          className={`carousel-slide ${i === current ? 'active' : ''}`}
          data-slide={i}
        >
          <img src={slide.img} alt={slide.title} />
          <div className="slide-content">
            <h3>{slide.title}</h3>
            <p>{slide.subtitle}</p>
          </div>
        </div>
      ))}
      <div className="slide-indicators">
        {SLIDES.map((_, i) => (
          <button
            key={i}
            type="button"
            className={`indicator ${i === current ? 'active' : ''}`}
            onClick={() => setCurrent(i)}
            aria-label={`Slide ${i + 1}`}
          />
        ))}
      </div>
    </div>
  );
}
