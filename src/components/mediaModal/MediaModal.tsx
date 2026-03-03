// src/components/pages/adminProjects/MediaModal.tsx
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
    detailsLabel = "About this Project", 
    ctaLabel = "View Project Source" 
}: MediaModalProps) {
    const [isVideoPlaying, setIsVideoPlaying] = useState(false);

    useEffect(() => {
        if (!show) setIsVideoPlaying(false);
    }, [show]);

    if (!item) return null;

    const hasMultipleSlides = item.gallery.length > 1;

    return (
        <Modal
            show={show}
            onHide={onClose}
            size="xl" 
            centered
            backdrop="static"
            keyboard={true}
            animation={true} 
            // Scoped class name here
            className="media-modal-custom"
            contentClassName='media-modal-content border-0 overflow-hidden'
        >
            <Modal.Header className='border-0 px-4 pt-4 pb-2' closeButton>
                <Modal.Title className="fw-bold modal-title-custom">{item.title}</Modal.Title>
            </Modal.Header>

            <Modal.Body className="p-0 border-0">
                <div className="bg-media-container">
                    <Carousel
                        className='custom-carousel-controls'
                        interval={isVideoPlaying || !hasMultipleSlides ? null : 5000}
                        pause="hover"
                        controls={hasMultipleSlides}   
                        indicators={hasMultipleSlides} 
                        onSlide={() => setIsVideoPlaying(false)}
                    >
                        {item.gallery.map((media, index) => (
                            <Carousel.Item key={index}>
                                <div className="ratio ratio-16x9 bg-black">
                                    <MediaRenderer
                                        type={media.type}
                                        url={media.url}
                                        // Pass a class that we can use for the 0.5s seek logic
                                        className="object-fit-contain w-100 h-100 intelligent-video-thumbnail"
                                        onPlay={() => setIsVideoPlaying(true)}
                                        onPause={() => setIsVideoPlaying(false)}
                                    />
                                </div>
                            </Carousel.Item>
                        ))}
                    </Carousel>
                </div>

                <div className="p-4 mx-auto" style={{ maxWidth: '850px' }}>
                    <h5 className="mb-3 fw-bold details-label-custom">{detailsLabel}</h5>
                    <p className="description-text">
                        {item.longDescription}
                    </p>
                </div>
            </Modal.Body>

            <Modal.Footer className='border-0 p-4 pt-0'>
                <Button variant="outline-light" className="px-4 opacity-75" onClick={onClose}>
                    Close
                </Button>
                {item.projectLink && (
                    <Button variant="primary" className="px-4 cta-button-custom" href={item.projectLink} target="_blank" rel="noopener noreferrer">
                        {ctaLabel}
                    </Button>
                )}
            </Modal.Footer>
        </Modal>
    );
}