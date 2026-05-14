import clsx from 'clsx';
import Heading from '@theme/Heading';
import styles from './styles.module.css';

const FeatureList = [
  {
    title: 'Zero Dependencies',
    icon: '🚀',
    description: (
      <>
        Nova Web Agent Core is built entirely from scratch with zero external dependencies. Drop it into any browser environment and it just works.
      </>
    ),
  },
  {
    title: 'Local-First Inference',
    icon: '🧠',
    description: (
      <>
        Powered by the cutting-edge WebGPU backend and MediaPipe, execute your agent's reasoning loops completely client-side without API keys.
      </>
    ),
  },
  {
    title: 'Extensible ReAct Loop',
    icon: '⚙️',
    description: (
      <>
        Fully customize the tools your agent has access to. The built-in ReAct loop efficiently manages thought chains and XML tool parsing.
      </>
    ),
  },
];

function Feature({icon, title, description}) {
  return (
    <div className={clsx('col col--4')}>
      <div className="text--center" style={{ fontSize: '4rem' }}>
        {icon}
      </div>
      <div className="text--center padding-horiz--md">
        <Heading as="h3">{title}</Heading>
        <p>{description}</p>
      </div>
    </div>
  );
}

export default function HomepageFeatures() {
  return (
    <section className={styles.features}>
      <div className="container">
        <div className="row">
          {FeatureList.map((props, idx) => (
            <Feature key={idx} {...props} />
          ))}
        </div>
      </div>
    </section>
  );
}
