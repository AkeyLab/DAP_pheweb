
from ..file_utils import VariantFileReader, get_filepath, get_tmp_path

import sqlite3
from pathlib import Path
from typing import List,Iterator,Tuple,Optional


def run(argv:List[str]) -> None:

    if '-h' in argv or '--help' in argv:
        print('Make sqlite3 db for converting between chr-pos-ref-alt and rsid')
        exit(1)

    print("GETTING STARTED WITH CPRAS")
    sites_filepath = Path(get_filepath('sites'))
    cpras_rsids_filepath = Path(get_filepath('cpras-rsids-sqlite3', must_exist=False))

    if cpras_rsids_filepath.exists() and cpras_rsids_filepath.stat().st_mtime >= sites_filepath.stat().st_mtime:
        print('cpras-rsids-sqlite3 is up-to-date!')

    else:
        def get_cpra_rsid_pairs() -> Iterator[Tuple[str,Optional[str]]]:
            with VariantFileReader(sites_filepath) as reader:
                for v in reader:
                    cpra = '{chrom}-{pos}-{ref}-{alt}'.format(**v)
                    if v['rsids']:
                        for rsid in v['rsids'].split(','):
                            yield (cpra, rsid)
                    else:
                        yield (cpra, None)

        if cpras_rsids_filepath.exists():
            print("ABOUT TO UNLINK", cpras_rsids_filepath)
            cpras_rsids_filepath.unlink()

        print("ABOUT TO CONNECT TO DB")
        #RB NOTE: Changed this to open the db_conn in a "with" block
        #RB NOTE: because the sql database wasn't closing automatically
        #RB NOTE: so the renaming was failing because the file was open
        #RB NOTE: but that didn't fix the error for some reason, so I just
        #RB NOTE: removed the tmp_file approach, I don't see why it is necessary
        with sqlite3.connect(str(cpras_rsids_filepath)) as db_conn:
            db_conn.execute('CREATE TABLE cpras_rsids (cpra TEXT, rsid TEXT)')
            db_conn.executemany('INSERT INTO cpras_rsids (cpra, rsid) VALUES (?,?)', get_cpra_rsid_pairs())
            db_conn.execute('CREATE INDEX rsid_idx ON cpras_rsids (rsid)')

        print("AFTER DB OPERATIONS")

        print('Done making cpras-rsids sqlite3 at {}'.format(str(cpras_rsids_filepath)))

