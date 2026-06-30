import { ROOF_CHANGE_OPTIONS } from '../../utils/roofChangeFlow';
import styles from './RoofChangeFollowUp.module.css';

export default function RoofChangeFollowUp({ selectedType, onSelect }) {
  return (
    <div className={styles.container}>
      <p className={styles.question}>What type of roof change was it?</p>
      <div className={styles.options}>
        {ROOF_CHANGE_OPTIONS.map((option) => (
          <button
            key={option.id}
            type="button"
            className={`${styles.option} ${selectedType === option.id ? styles.selected : ''}`}
            onClick={() => onSelect(option.id)}
          >
            {option.label}
          </button>
        ))}
      </div>
    </div>
  );
}
