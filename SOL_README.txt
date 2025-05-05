Started on Apr 15th 2025; Rob
-----------------------------

Vista shared updated GWAS datasets that I need to use to make
and updated PheWeb website.

I created this folder by copying the last PheWeb release:
    `cp -r DAP_pheweb_20240719 DAP_pheweb_20250415`

This copying includes the old `data/` folder which I'll need to change
based on Vista's new GWAS results


Here's the message Vista shared on slack:

    I have attached a metadata sheet that contains the updated sample sizes for
    each phenotype to be displayed on PheWeb. Phenotype column can be used to find
    the association files in the following directories:
    /scratch/vsohrab/dap_precision2024_metabolite_gwas/association
    /scratch/vsohrab/dap_precision2024_blood_gwas/association
    /scratch/vsohrab/dap_gwas_geneticset2023_datarelease2022_nextflow/association
    The first directory is for updated metabolite GWAS, while second directory is
    for blood phenotype GWAS, and the final directory is for survey question GWAS
    (but no changes have been made to the survey GWAS - if that is helpful
    information to not have to change anything for survey data)
    pheweb_phenotype_name column refers to the phenotype name to be displayed on
    PheWeb and pheweb_phenotype_category column describes the category a phenotype
    belongs to
     
     phenotype  pheweb_phenotype_name   pheweb_phenotype_category   sample_size
     afus_dora_1_excited_food   afus_dora_1_excited_food    Eating Behavior 4789
     afus_dora_10_runs_around_alot  afus_dora_10_runs_around_alot   Eating Behavior
     4789 afus_dora_11_interested_eating_after_meal
     afus_dora_11_interested_eating_after_meal   Eating Behavior 4789
     afus_dora_12_slow_eater    afus_dora_12_slow_eater Eating Behavior 4789
     afus_dora_13_eats_treats_quickly   afus_dora_13_eats_treats_quickly    Eating
     Behavior 4789 afus_dora_14_human_food_during_meals
     afus_dora_14_human_food_during_meals    Eating Behavior 4789
     afus_dora_15_eat_anything  afus_dora_15_eat_anything   Eating Behavior 4789
     afus_dora_16_very_fit  afus_dora_16_very_fit   Eating Behavior 4789
     afus_dora_17_human_food_often  afus_dora_17_human_food_often   Eating Behavior
     4789 ...


    Please let me know if there is anything else I missed that is needed for the
    update. Thank you


----------------------------------------------------
Initial folder setup to prepare for the updated GWAS
----------------------------------------------------
I've uploaded the file that Vista attached in this folder as:
    pheweb_included_phenotypes_N-313_metadata.tsv

I think I need to use this file to make a new `pheno-list.json`

I'm going to delete the contents of `generated-by-pheweb/` because
that was generated with the old datasets
--> rm -rf generated-by-pheweb/*

Similarly going to delete the contents of the `data/` folder
--> rm -rf data/*

Delete the old `pheweb_env/` venv folder and create a new one following the
directions from `sol_install_notes.txt`
--> Initially ran into issues but now it's working

Then changed `run_process_pheweb.sbatch` to use the new pheweb installation
--> Didn't really have to run these last two steps honestlly since
    local pheweb is identical for 20250415 and 20240719

Running `sbatch run_process_pheweb.sbatch` took ~3.5 hours

--------------------------------------------
Preparing the data files for use with PheWeb
--------------------------------------------
First let me make sure I can access all these files where Vista pointed me.
In total there should be 313 files, one for each row in:
    pheweb_included_phenotypes_N-313_metadata.tsv
    
These should be in the directories Vista mentioned and these folders only
contain files that have .mlma suffixes

    * /scratch/vsohrab/dap_precision2024_metabolite_gwas/association
    --> Has 133 .mlma files

    * /scratch/vsohrab/dap_precision2024_blood_gwas/association
    --> Has 42 .mlma files

    * /scratch/vsohrab/dap_gwas_geneticset2023_datarelease2022_nextflow/association
    --> Has 202 .mlma files

So there's a total of 377 .mlma files, but they must not all be listed in
the `pheweb_included_phenotypes_N-313_metadata.tsv` file

I think I remember I need to convert these .mlma files into .csv files which
is why there is the `mlma_to_csv.py` script
--> This script takes in a list of .mlma files and outputs to data/*.csv

I'm going to delete the existing files in the data/ folder because we'll remake these
based on the new .mlma files

I think the next step is finding the full paths of all the .mlma files using the
three folders above and matching them with the metadata table:
    `pheweb_included_phenotypes_N-313_metadata.tsv`

I'll do this in ipython at first, then make a .py script to make it more reproducible.
Created this file which can be run with `./find_mlmas.py` and generates the table:
    `mlma_paths_with_metadata.csv`
which has the full path info for each .mlma matched to each row in the metadata!

I created the file `process_mlmas_to_csv.sbatch` which converts each of the .mlma
files into a .csv in the data/ folder, using the `mlma_paths_with_metadata.csv` as input

----------------------------
Creating the pheno-list.json
----------------------------
I'll be using the current pheno-list.json as a guide so I'll copy that
to `old_pheno-list.json`

The pheno-list.json is a JSON file where the outer layer is a list
and then each element of the list is a dictionary with fields for
the `assoc_files`, `phenocode`, `category`, and `num_samples`:
    [
        {
            "assoc_files": [
                "data/afus_dora_3_human_leftovers_in_bowl_N-4895.loco.csv"
            ],
            "phenocode": "afus_dora_3_human_leftovers_in_bowl",
            "category": "Eating Behavior",
            "num_samples": 4789
        },
        {

I can make this file from the `mlma_paths_with_metadata.csv`
by modifying and running the script with `./create_pheno_list.py`

I think this is successful, but we'll see if `pheweb process` gives errors

------------------------
Running `pheweb process`
------------------------
Made sure to use the new python venv, but otherwise didn't make changes
to the `run_process_pheweb.sbatch` script (well I also went from 20G to 40G)
Last time this took ~9 hours so fingers-crossed

Submitted SLURM job is 25325615

Dang, got an error after 2.5 hours:
    ==> Starting `pheweb make-gene-aliases-sqlite3`                                    
    gene aliases will be stored at '/scratch/rbierma1/DAP_pheweb_20250415/generated-by-pheweb/resources/gene_aliases-v37.sqlite3'
    IN GET GENE ALIASES!!!!                                                            
    num canonical gene names: 39944                                                    
    ==> failed after 5 seconds                                                         
                                                                                    
    An exception occurred                                                           
    (Details in /scratch/rbierma1/DAP_pheweb_20250415/generated-by-pheweb/tmp/exception-2025-04-16T20-28-37.855123)

The more details file gives "HTTP Error 404: Not Found" and it was trying to open:
    r = urllib.request.urlopen('http://ftp.ebi.ac.uk/pub/databases/genenames/new/json/non_alt_loci_set.json')

which is happening in:
    /scratch/rbierma1/DAP_pheweb_20250415/pheweb/load/make_gene_aliases_sqlite3.py

Looks like this file no longer exists on EBI, I'll have to look in the code and see if I can comment it out
ok, I'll rerun with this change. I think it should be ok(?)
--> Ok, there's actually a PheWeb github issue about this which gives the new URL:
    https://github.com/statgen/pheweb/issues/237
--> If I run into issues I'll uncomment and change the URL
--> I don't think it should matter though because the dog isn't in the list anyway

Rerun is SLURM job 25343866
--> Ok great, it cached the previous steps so it's picking up where it left off
--> Succeded in 5.5 hours
--> Combined with the previous partial-job, this run took 8 hours
    which is 1 hour faster than last time, but I gave more RAM


I saved/pushed these changes to the dev branch here:
    https://github.com/AkeyLab/DAP_pheweb

----------------------------------
Transfering build artifacts to AWS
----------------------------------
Accessing AWS instance through ssh:
    ssh -i "Pheweb.pem" ubuntu@ec2-3-144-223-60.us-east-2.compute.amazonaws.com

This is the currently running PheWeb server running at:
    http://ec2-3-144-223-60.us-east-2.compute.amazonaws.com:8000/

I'm doing the running in a tmux session called `serve` from within the folder:
    /home/ubuntu/DAP_pheweb_20240719

Which has the contents:
    PheWeb.egg-info
    aws_run_notes.txt
    build/
    generated-by-pheweb/
    pheno-list.json
    pheweb/
    setup.cfg
    setup.py

Oh, I left good notes for myself! Here's what I did last time which I'll basically
copy for this time:

    July 23 2024; Rob

    Copied just the "generated-by-pheweb/" folder and "pheweb/" here for serving
    shouldn't need to build here.

    Did the scp from sol with the following commands:
    * scp -i "Pheweb.pem" -r generated-by-pheweb/ ubuntu@ec2-3-144-223-60.us-east-2.compute.amazonaws.com:/home/ubuntu/DAP_pheweb_20240719
    * scp -i "Pheweb.pem" -r pheweb/ ubuntu@ec2-3-144-223-60.us-east-2.compute.amazonaws.com:/home/ubuntu/DAP_pheweb_20240719
    * scp -i "Pheweb.pem" setup.* ubuntu@ec2-3-144-223-60.us-east-2.compute.amazonaws.com:/home/ubuntu/DAP_pheweb_20240719
    * scp -i "Pheweb.pem" pheno-list.json  ubuntu@ec2-3-144-223-60.us-east-2.compute.amazonaws.com:/home/ubuntu/DAP_pheweb_20240719

    steps for installing pheweb
    * python3.8 -m venv .venv
    * source .venv/bin/activate
    * pip install -e .

Oh, one note is that I'm currently using 95G out of 124G of disk and I'm expecting
around 70G of space needed for the transfer of the new version. I think I'll increase
the disk size so I can keep both copies on the EC2 instance in case we want to go back

I took a snapshot of the volume for safety and then I expanded it to 256G
I don't think this should cost too much more. EC2 and EC2-Other costs are currently
around $45 a month

There were quite a few steps to follow for volume expansion in the directions here:
    https://docs.aws.amazon.com/ebs/latest/userguide/recognize-expanded-volume-linux.html?icmpid=docs_ec2_console

But it worked so now we have plenty of space for the transfer after `pheweb process` finishes:
    ubuntu@ip-172-31-25-46:~$ df -h
    Filesystem      Size  Used Avail Use% Mounted on
    /dev/root       248G   95G  154G  39% /

The current July 2024 version of PheWeb stayed accessible during this volumne increase!

Ok, now I'm transferring the build artifacts with the following commands

    * scp -i "Pheweb.pem" -r generated-by-pheweb/ ubuntu@ec2-3-144-223-60.us-east-2.compute.amazonaws.com:/home/ubuntu/DAP_pheweb_20250415
    * scp -i "Pheweb.pem" -r pheweb/ ubuntu@ec2-3-144-223-60.us-east-2.compute.amazonaws.com:/home/ubuntu/DAP_pheweb_20250415
    * scp -i "Pheweb.pem" setup.* ubuntu@ec2-3-144-223-60.us-east-2.compute.amazonaws.com:/home/ubuntu/DAP_pheweb_20250415
    * scp -i "Pheweb.pem" pheno-list.json  ubuntu@ec2-3-144-223-60.us-east-2.compute.amazonaws.com:/home/ubuntu/DAP_pheweb_20250415

    steps for installing pheweb
    * python3.8 -m venv .venv
    * source .venv/bin/activate
    * pip install -e .

Then to serve pheweb, as long as the venv is activated with the source command above, just:
    pheweb serve

Run this command in a tmux session so it stays running

Later realized that I don't have to transfer the per-phenotype .gz files to AWS
since those aren't used to serve the website, they are just intermediate files
used to cache progress of `pheweb process`
--> Not transferring these files would have saved 28GB
--> These files are in generated-by-pheweb/pheno_gz/

Oh dang, I realized I made a mistake when creating the pheno-list.json where I
used the wrong column to specify the "Category" of the "Phenotypes".
--> This was an easy fix, but I need to rerun the `process pheweb` which will
    likely take a few hours, I think the later steps aren't cached
--> This is SLURM job 25353624 and took 5.5 hours again

I then copied over the `generated_by_pheweb/` folder again to get the correct categories

I think everything else looks good as of today Apr 17th 2025, and the new version
of the PheWeb website is live:
    http://ec2-3-144-223-60.us-east-2.compute.amazonaws.com:8000/

----------------------
Update on May 2nd 2025
----------------------
Vista noticed an error where two phenotypes had the category "shortUnclassified metabolite chain fatty acid"
but they should have been called "short-chain fatty acid"

This was an easy fix, I just did a find-and-replace in the following two files
- generated-by-pheweb/phenotypes.json
- pheno-list.json

I then restarted the `pheweb serve` 

