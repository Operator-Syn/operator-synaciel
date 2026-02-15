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

    if (isLoading || !items) {
        return <ElevatorPitchPlaceholder />;
    }

    return (
        <div className="light-glass-blue-hue flex-grow-1 p-3 rounded shadow-sm">
            {items.map((item, index) => (
                <div key={index}>
                    <h3 className="m-0">{item.title}</h3>
                    <hr />
                    <p className="text-justify m-0">{item.content}</p>
                </div>
            ))}
        </div>
    );
}