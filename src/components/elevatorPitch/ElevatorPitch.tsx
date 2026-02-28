// src/components/elevatorPitch/ElevatorPitch.tsx
import ElevatorPitchPlaceholder from "./ElevatorPitchPlaceholder";
import "./ElevatorPitch.css"; 

interface ElevatorPitchItem {
    title: string;
    content: string;
}

interface ElevatorPitchProps {
    items?: ElevatorPitchItem[];
    isLoading?: boolean; 
}

export default function ElevatorPitchComponent(props: ElevatorPitchProps) {
    const { items, isLoading } = props;

    if (isLoading || !items || items.length === 0) {
        return <ElevatorPitchPlaceholder />;
    }

    // Since every item in this section currently gets the same title 
    // from the database, we display it once at the top.
    const displayTitle = items[0]?.title || "Know 'lil more about me";

    return (
        <div className="light-glass-blue-hue flex-grow-1 p-3 rounded shadow-sm">
            <h3 className="m-0">{displayTitle}</h3>
            <hr />
            {items.map((item, index) => (
                <p key={index} className="text-justify m-0 mb-3">
                    {item.content}
                </p>
            ))}
        </div>
    );
}