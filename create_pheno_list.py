#!/scratch/rbierma1/DAP_pheweb_20240719/pheweb_env/bin/python
import pandas as pd
import glob
import json
import os

#get the fpaths, the output of mlma_to_csv.py
df = pd.DataFrame({
    'fpath': glob.glob('data/*.csv'),
})

df['fname'] = df['fpath'].apply(os.path.basename)
df['phenotype'] = df['fname'].str.split('_N-').str[0]

#get the categories and merge into the df
cats = pd.read_table('metadata/phenotype_categories.tsv')

rows_before_merge = len(df.shape)

df = df.merge(cats)

rows_after_merge = len(df.shape)
assert rows_before_merge == rows_after_merge
assert not df.isnull().any().any()

#get the sample_size and merge into the df
sample_size = pd.read_table('metadata/DAP_phenotypes_291_gwas_sample_sizes.tsv')

rows_before_merge = len(df.shape)

df = df.merge(sample_size)

rows_after_merge = len(df.shape)
assert rows_before_merge == rows_after_merge
assert not df.isnull().any().any()

json_data = []
for i,r in df.iterrows():
    json_data.append({
        'assoc_files': [ r['fpath'] ],
        'phenocode': r['phenotype'],
        'category': r['category'],
        'num_samples': r['sample_size'],
    })

with open('pheno-list.json', 'w') as f_out:
    json.dump(json_data, f_out, indent=4)

