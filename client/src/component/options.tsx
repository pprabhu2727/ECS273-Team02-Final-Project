/**
 * Props for the species selection dropdown component
 * This interface ensures type safety for the bird species selection functionality
 */
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
      {/* Generate option elements for each available species */}
      {/* Using index as key is acceptable here since the species list is static */}
      {speciesList.map((name, index) => (
        <option key={index} value={name}>
          {name}
        </option>
      ))}
    </select>
  );
}