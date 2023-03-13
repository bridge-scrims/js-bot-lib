import { DataSource } from 'typeorm';
import { globSync } from 'glob';

/** typeorm has this feature built in but it doesn't work */
function requireAll(pattern: string) {
    return globSync(pattern)
        .filter(f => f.endsWith('.js'))
        .map(path => Object.values(require("./" + path))[0]) as Function[]
}

export default new DataSource({
    type: 'postgres',
    url: process.env.POSTGRES_CONN_URI,
    logging: !!process.env.DEBUG,
    entities: requireAll(`db/entities/**`) ,
    migrations: requireAll(`db/migrations/**`),
    migrationsRun: true,
    synchronize: false,
});