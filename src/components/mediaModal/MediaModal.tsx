// src/components/mediaModal/MediaModal.tsx
import { useState, useEffect } from 'react';
import { Modal, Button, Carousel } from 'react-bootstrap';
import { type MediaItem } from '../../types/MediaCardTypes';
import MediaRenderer from '../mediaRenderer/MediaRenderer';
import './MediaModal.css'

interface MediaModalProps {
    item: MediaItem | null;
    show: boolean;
    onClose: () => void;
    detailsLabel?: string;
    ctaLabel?: string;
}

export default function MediaModal({ 
    item, 
    show, 
    onClose, 
    detailsLabel = "Details", 
    ctaLabel = "View" 
}: MediaModalProps) {
    const [isVideoPlaying, setIsVideoPlaying] = useState(false);

    useEffect(() => {
        if (!show) setIsVideoPlaying(false);
    }, [show]);

    if (!item) return <Modal show={show} onHide={onClose} centered animation={true} />;

    const hasMultipleSlides = item.gallery.length > 1;

    return (
        <Modal
            show={show}
            onHide={onClose}
            size="xl" 
            fullscreen="sm-down" 
            centered
            backdrop="static"
            keyboard={true}
            animation={true} 
            contentClassName='light-glass-blue-hue-opaque border-0'
        >
            <Modal.Header className='border-0 px-4' closeButton>
                <Modal.Title>{item.title}</Modal.Title>
            </Modal.Header>

            <Modal.Body className="p-0 border-0">
                <Carousel
                    className='border-0 custom-carousel-controls'
                    interval={isVideoPlaying || !hasMultipleSlides ? null : 5000}
                    pause="hover"
                    controls={hasMultipleSlides}   
                    indicators={hasMultipleSlides} 
                    touch={true} 
                    onSlide={() => setIsVideoPlaying(false)}
                >
                    {item.gallery.map((media, index) => (
                        <Carousel.Item key={index}>
                            <div className="ratio ratio-16x9 bg-dark border-0">
                                <MediaRenderer
                                    type={media.type}
                                    url={media.url}
                                    className="object-fit-contain w-100 h-100 border-0"
                                    onPlay={() => setIsVideoPlaying(true)}
                                    onPause={() => setIsVideoPlaying(false)}
                                />
                            </div>
                        </Carousel.Item>
                    ))}
                </Carousel>

                <div className="p-4">
                    <h5>{detailsLabel}</h5>
                    <p className="global-font-color">{item.longDescription}</p>
                </div>
            </Modal.Body>

            <Modal.Footer className='border-0 p-4 pt-0'>
                <Button variant="secondary" onClick={onClose}>Close</Button>
                {item.projectLink && (
                    <Button variant="primary" href={item.projectLink} target="_blank" rel="noopener noreferrer">
                        {ctaLabel}
                    </Button>
                )}
            </Modal.Footer>
        </Modal>
    );
}