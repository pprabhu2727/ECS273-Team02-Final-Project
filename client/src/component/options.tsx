interface SpeciesOptionsProps {
  speciesList: string[];
  selectedSpecies: string;
  onSelectSpecies: (species: string) => void;
}

export default function RenderSpeciesOptions({ 
  speciesList, 
  selectedSpecies, 
  onSelectSpecies 
}: SpeciesOptionsProps) {
  return (
    <select 
      className="bg-white text-black p-2 rounded mx-2"
      value={selectedSpecies}
      onChange={(e) => onSelectSpecies(e.target.value)}
    >
      {speciesList.map((name, index) => (
        <option key={index} value={name}>
          {name}
        </option>
      ))}
    </select>
  );
}