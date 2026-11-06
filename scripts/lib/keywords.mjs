// Keyword taxonomy for matching a job description. Each canonical skill maps
// to the surface forms a posting might use for it ("compose" also appears as
// "jetpack compose" and "declarative ui").
//
// THIS FILE IS GENERIC AND YOU SHOULD NOT NEED TO EDIT IT, beyond adding a
// skill the taxonomy is missing. What you DO need to edit is
// config/skills.config.mjs, which records which of these you actually have.
// COVERAGE, WEIGHT and HARD_GAPS are re-exported from there so every script
// sees one answer.

export const TAXONOMY = {
  kotlin:        ['kotlin', 'kotlin multiplatform', 'kmp'],
  java:          ['java'],
  compose:       ['jetpack compose', 'compose', 'declarative ui'],
  androidsdk:    ['android sdk', 'android studio', 'android development', 'native android'],
  flutter:       ['flutter'],
  dart:          ['dart'],
  bloc:          ['bloc', 'cubit', 'provider', 'riverpod', 'getx'],
  swift:         ['swift', 'swiftui'],
  uikit:         ['uikit', 'objective-c', 'objective c'],
  ios:           ['ios', 'iphone', 'ipados', 'apple'],
  reactnative:   ['react native', 'react-native'],

  mvvm:          ['mvvm', 'mvi', 'mvp'],
  clean:         ['clean architecture', 'layered architecture', 'modular architecture', 'solid'],
  di:            ['hilt', 'dagger', 'koin', 'dependency injection'],
  coroutines:    ['coroutines', 'kotlin flow', 'rxjava', 'reactive', 'async'],

  rest:          ['rest', 'restful', 'api integration', 'retrofit', 'okhttp', 'http'],
  graphql:       ['graphql', 'apollo'],
  websocket:     ['websocket', 'socket.io', 'real-time', 'realtime', 'streaming'],
  grpc:          ['grpc', 'protobuf'],

  room:          ['room', 'sqlite', 'core data', 'realm', 'local database'],
  offline:       ['offline', 'offline-first', 'sync', 'workmanager', 'background sync'],

  firebase:      ['firebase', 'fcm', 'crashlytics', 'push notification', 'remote config', 'analytics'],
  maps:          ['google maps', 'mapbox', 'geolocation', 'geofencing', 'location tracking', 'gps'],

  ml:            ['tensorflow', 'tflite', 'tensor flow lite', 'machine learning', 'on-device ml', 'ai', 'ml kit', 'mlkit', 'computer vision', 'ocr'],
  camera:        ['camerax', 'camera2', 'avfoundation', 'camera', 'image processing'],
  biometric:     ['biometric', 'face recognition', 'liveness', 'ekyc', 'kyc', 'identity verification', 'fingerprint'],

  fintech:       ['fintech', 'banking', 'payment', 'wallet', 'financial', 'transaction', 'pci', 'neobank', 'remittance', 'trading'],
  security:      ['security', 'encryption', 'owasp', 'ssl pinning', 'certificate pinning', 'secure storage', 'keystore', 'keychain', 'obfuscation', 'proguard', 'oauth', 'jwt', 'token'],

  testing:       ['unit test', 'unit testing', 'junit', 'espresso', 'xctest', 'mockito', 'ui test', 'test coverage', 'tdd', 'automated test', 'instrumentation test'],
  cicd:          ['ci/cd', 'cicd', 'continuous integration', 'github actions', 'jenkins', 'bitrise', 'fastlane', 'gitlab ci', 'azure devops', 'codemagic'],
  release:       ['app store', 'google play', 'play console', 'app store connect', 'testflight', 'release management', 'app distribution'],

  performance:   ['performance', 'optimization', 'memory', 'battery', 'profiling', 'anr', 'crash rate', 'app size'],
  accessibility: ['accessibility', 'a11y', 'wcag'],
  git:           ['git', 'github', 'gitlab', 'bitbucket', 'version control', 'pull request', 'code review'],
  agile:         ['agile', 'scrum', 'kanban', 'jira', 'sprint', 'confluence'],
  python:        ['python'],
  backendsvc:    ['backend', 'back-end', 'server-side', 'server side', 'api development', 'web service'],
  springboot:    ['spring boot', 'springboot', 'spring framework', 'spring mvc', 'hibernate', 'jpa'],
  pyweb:         ['fastapi', 'flask', 'django'],
  nodejs:        ['node.js', 'nodejs', 'express.js', 'expressjs', 'nestjs', 'nest.js'],
  dotnet:        ['.net', 'dotnet', 'c#', 'asp.net', 'vb.net', 'blazor', 'entity framework'],
  golang:        ['golang', 'go lang'],
  phpruby:       ['php', 'laravel', 'symfony', 'ruby on rails', 'rails'],
  microservices: ['microservice', 'micro-service', 'service mesh', 'distributed system', 'event-driven'],
  messaging:     ['kafka', 'rabbitmq', 'sqs', 'message queue', 'pub/sub', 'pubsub', 'celery'],
  dbdesign:      ['schema design', 'database design', 'data modelling', 'data modeling', 'database architecture', 'normalization', 'query optimization', 'stored procedure', 'oracle'],
  orm:           ['orm', 'sqlalchemy', 'prisma', 'sequelize', 'typeorm'],
  nosql:         ['mongodb', 'redis', 'cassandra', 'dynamodb', 'elasticsearch', 'nosql'],
  k8s:           ['kubernetes', 'k8s', 'helm', 'openshift'],
  terraform:     ['terraform', 'ansible', 'pulumi', 'infrastructure as code'],
  jsfw:          ['react', 'react.js', 'reactjs', 'angular', 'vue', 'vue.js', 'svelte'],
  typescript:    ['typescript'],
  otherlang:     ['clojure', 'scala', 'elixir', 'erlang', 'haskell', 'perl', 'c++', 'cobol', 'delphi', 'matlab', 'rust', 'akka'],
  sqldb:         ['postgresql', 'postgres', 'mysql', 'sql database', 'relational database'],
  cloud:         ['aws', 'azure', 'ec2', ' s3 ', 'gcp', 'google cloud', 'cloud infrastructure', 'cloud deployment'],
  containers:    ['docker', 'containeris', 'containeriz'],
  web:           ['next.js', 'nextjs', 'frontend', 'front-end', 'web application', 'html', 'css'],
  llm:           ['llm', 'rag', 'generative ai', 'genai', 'openai', 'ollama', 'chatgpt', 'prompt engineering', 'ai agent'],
  leadership:    ['mentor', 'lead', 'lead a team', 'ownership', 'stakeholder', 'cross-functional'],
};

// COVERAGE, WEIGHT and HARD_GAPS describe YOU, not the taxonomy, so they live
// in config/skills.config.mjs. Re-exported here so existing imports of this
// module keep working.
export { COVERAGE, WEIGHT, HARD_GAPS } from '../../config/skills.config.mjs';

export function scanJd(text) {
  const hay = ' ' + text.toLowerCase().replace(/\s+/g, ' ') + ' ';
  const hits = {};
  for (const [canon, forms] of Object.entries(TAXONOMY)) {
    const matched = forms.filter(f => hay.includes(f));
    if (matched.length) hits[canon] = matched;
  }
  return hits;
}
